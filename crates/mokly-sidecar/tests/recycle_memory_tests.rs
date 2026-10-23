//! Real PostCSS children exit on pool recycling and the replacement stays available.

use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::{Call, ModuleResolution, ProcessCss};
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::{MemoryFactory, ResidentMemory, SystemMemory};
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

struct FirstWorkerLarge(Mutex<Vec<u32>>);
struct Sample {
    real: Box<dyn ResidentMemory>,
    oversized: bool,
}
impl MemoryFactory for FirstWorkerLarge {
    fn monitor(&self, pid: u32) -> Box<dyn ResidentMemory> {
        let mut workers = self.0.lock().unwrap();
        let oversized = workers.is_empty();
        workers.push(pid);
        Box::new(Sample {
            real: SystemMemory.monitor(pid),
            oversized,
        })
    }
}
impl ResidentMemory for Sample {
    fn resident_bytes(&self, discover: bool) -> Result<u64> {
        let bytes = self.real.resident_bytes(discover)?;
        Ok(if self.oversized { 1_073_741_825 } else { bytes })
    }
}
struct Reporter;
impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
}
fn pid(result: MethodResult) -> u32 {
    let MethodResult::Css(css) = result else {
        panic!("CSS result required")
    };
    css.text
        .split("value:")
        .nth(1)
        .unwrap()
        .trim()
        .split(|character: char| !character.is_ascii_digit())
        .next()
        .unwrap()
        .parse()
        .unwrap()
}
fn assert_released(pid: u32) {
    let memory = SystemMemory.monitor(pid);
    let deadline = Instant::now() + Duration::from_secs(10);
    while memory.resident_bytes(false).unwrap() != 0 && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(memory.resident_bytes(false).unwrap(), 0, "process {pid}");
}

#[test]
fn recycle_reaps_postcss_children_and_the_next_worker_does_not_recycle_again() {
    let root = tempfile::tempdir().unwrap();
    fs::write(
        root.path().join("postcss.mjs"),
        r#"
export default {plugins:[{postcssPlugin:'pid',Once(root){
  root.removeAll(); root.append({selector:'.pid',nodes:[{prop:'value',value:String(process.pid)}]});
}}]};
"#,
    )
    .unwrap();
    fs::write(root.path().join("source.css"), ".input {color:red}").unwrap();
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let memory = Arc::new(FirstWorkerLarge(Mutex::new(Vec::new())));
    let clock = Arc::new(SystemClock::new());
    let pool: &dyn SidecarPool = &Pool::new(
        Arc::new(NodeFactory::new(
            Arc::new(SystemProcessGroups),
            clock.clone(),
            Arc::new(Reporter),
            memory.clone(),
        )),
        clock,
        Launch {
            node: "node".into(),
            entry: workspace.join("packages/mokly/dist/sidecar.js"),
            repository: root.path().into(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    let call = Call::ProcessCss(ProcessCss {
        context: "recycle".into(),
        source_root: root.path().to_string_lossy().into_owned(),
        repository_roots: Vec::new(),
        module_resolution: ModuleResolution {
            package_roots: vec![workspace.to_string_lossy().into_owned()],
            ..Default::default()
        },
        postcss: "postcss.mjs".into(),
        source_path: "source.css".into(),
        text: ".input {color:red}".into(),
    });
    let first = pid(pool.request(call.clone()).unwrap());
    assert_eq!(pid(pool.request(call.clone()).unwrap()), first);
    assert_released(first);
    assert_released(memory.0.lock().unwrap()[0]);
    let next = pid(pool.request(call.clone()).unwrap());
    assert_ne!(first, next);
    assert_eq!(pid(pool.request(call).unwrap()), next);
    assert_eq!(memory.0.lock().unwrap().len(), 2);
    assert!(SystemMemory.monitor(next).resident_bytes(false).unwrap() > 0);
    pool.shutdown().unwrap();
    assert_released(next);
}
