//! A forced memory sample recycles the real worker without clocks or polling.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::material::digest;
use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::{Call, ModuleResolution, ProcessCss};
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::postcss_evidence::{Coverage, Read};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::{MemoryFactory, ResidentMemory};
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;

#[path = "../../../tests/rust/package_version.rs"]
mod package_version;

struct Memory(AtomicUsize);
struct Sample(bool);
impl MemoryFactory for Memory {
    fn monitor(&self, _: u32) -> Box<dyn ResidentMemory> {
        Box::new(Sample(self.0.fetch_add(1, Ordering::SeqCst) == 0))
    }
}
impl ResidentMemory for Sample {
    fn resident_bytes(&self, _: bool) -> Result<u64> {
        Ok(if self.0 { 1_073_741_825 } else { 0 })
    }
}
struct Reporter;
impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
}

fn process(pool: &dyn SidecarPool, call: &Call) -> Css {
    let MethodResult::Css(result) = pool.request(call.clone()).unwrap() else {
        panic!("CSS result required")
    };
    result
}

#[test]
fn consumed_configuration_reads_survive_context_reuse_and_real_pool_replacement() {
    let temporary = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let tokens = root.join("tokens.txt");
    fs::write(&tokens, "old").unwrap();
    fs::write(
        root.join("postcss.mjs"),
        r#"
import fs from 'node:fs';
const value=fs.readFileSync('tokens.txt','utf8');
export default {plugins:[{postcssPlugin:'cached',Once(root,{result}){
root.append({prop:'from',value});
result.messages.push({type:'dependency',file:'tokens.txt'});
}}]};
"#,
    )
    .unwrap();
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let memory = Arc::new(Memory(AtomicUsize::new(0)));
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
            repository: root.clone(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    );
    let call = Call::ProcessCss(ProcessCss {
        context: "read-evidence".into(),
        source_root: root.to_string_lossy().into_owned(),
        repository_roots: vec![],
        module_resolution: ModuleResolution {
            package_roots: vec![workspace.to_string_lossy().into_owned()],
            ..Default::default()
        },
        postcss: "postcss.mjs".into(),
        source_path: "source.css".into(),
        text: "a{}".into(),
    });
    let original = process(pool, &call);
    fs::write(&tokens, "new").unwrap();
    let reused = process(pool, &call);
    let replacement = process(pool, &call);
    pool.shutdown().unwrap();
    assert_eq!(memory.0.load(Ordering::SeqCst), 2);
    for (result, value) in [(&original, "old"), (&reused, "old"), (&replacement, "new")] {
        assert!(
            result.text.contains(&format!("from: {value}")),
            "{}",
            result.text
        );
        assert!(matches!(
            result.read_evidence.coverage,
            Coverage::Incomplete
        ));
        let versions: Vec<_> = result
            .read_evidence
            .reads
            .iter()
            .filter_map(|read| {
                let Read::WholeFile { path, digest, .. } = read else {
                    return None;
                };
                (path == &tokens.to_string_lossy()).then_some(digest.as_str())
            })
            .collect();
        assert_eq!(versions, vec![digest(value.as_bytes())]);
    }
}
