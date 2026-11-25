//! Real sidecar fixtures for interpolated TypeScript paths targets.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::{Bundle, BundleRequest, Call};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::results;
use mokly_sidecar::workers::Diagnostics;

#[path = "package_version.rs"]
pub(super) mod package_version;

/// Count real esbuild calls from the sidecar process.
#[derive(Default)]
pub struct Counts(pub AtomicUsize);

impl Diagnostics for Counts {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }

    fn operation(&self, operation: Operation, _: u32) {
        if operation == Operation::Esbuild {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }
}

/// Keep both candidate directories present before the earlier target is added.
pub fn fixture(root: &Path) {
    fs::create_dir_all(root.join("one")).unwrap();
    fs::create_dir_all(root.join("two")).unwrap();
    fs::write(root.join("package.json"), "{}").unwrap();
    fs::write(root.join("one/.keep"), "").unwrap();
    fs::write(root.join("two/value.js"), "export const value='two';").unwrap();
    fs::write(root.join("entry.ts"), "export {value} from '@/value.js';").unwrap();
    fs::write(
        root.join("tsconfig.json"),
        r#"{"compilerOptions":{"paths":{"@/*":["${configDir}/one/*","${configDir}/two/*"]}}}"#,
    )
    .unwrap();
}

/// Add the first native candidate without changing a consumed directory.
pub fn add_earlier(root: &Path) {
    fs::write(root.join("one/value.js"), "export const value='one';").unwrap();
}

/// Start a fresh sidecar without a disk bundle store.
pub fn pool(root: &Path, counts: Arc<Counts>) -> Pool {
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let clock = Arc::new(SystemClock::new());
    Pool::new(
        Arc::new(NodeFactory::new(
            Arc::new(SystemProcessGroups),
            clock.clone(),
            counts,
            Arc::new(SystemMemory),
        )),
        clock,
        Launch {
            capture_durability: false,
            node: "node".into(),
            entry: workspace.join("packages/mokly/dist/sidecar.js"),
            repository: root.into(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    )
}

/// Compile the fixture through the public sidecar request API.
pub fn bundle(pool: &Pool, root: &Path) -> results::Bundle {
    pool.request(Call::Bundle(BundleRequest {
        preparation: None,
        plan: None,
        params: Bundle {
            vite: false,
            vite_inputs: None,
            evaluation: None,
            entry_files: vec!["entry.ts".into()],
            stories_files: Vec::new(),
            instance_name_props: None,
            renderer: None,
            source_root: root.to_string_lossy().into_owned(),
            configuration_directory: ".".into(),
            repository_roots: Vec::new(),
            module_resolution: Default::default(),
        },
        capture: None,
    }))
    .unwrap()
    .into_bundle()
}

/// Read selected authored modules from the bundle result.
pub fn module_names(result: &results::Bundle) -> Vec<&str> {
    result
        .modules
        .iter()
        .map(|module| module.path.as_str())
        .collect()
}
