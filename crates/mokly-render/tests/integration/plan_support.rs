//! Minimal real-sidecar fixture with a Serve-head owner and physical evidence checks.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::cache::MemoryCache;
use mokly_graph::workers::ThreadWorkers;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::physical_inputs::SystemPhysicalInputs;
use mokly_render::runtime::Runtime;
use mokly_sidecar::bundle_store::{BundleStoreMock, ReadMiss, ReadOutcome, WriteOutcome};
use mokly_sidecar::methods::{BundleCapture, Call};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::Pool;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::Diagnostics;
use tempfile::TempDir;
use unimock::{MockFn, Unimock, matching};

use super::support::{CapturedPool, package_version, workspace};

#[derive(Default)]
struct Counts(AtomicUsize);

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

pub(super) struct Fixture {
    _directory: TempDir,
    root: PathBuf,
    pub(super) runtime: Runtime,
    pool: Arc<CapturedPool>,
    counts: Arc<Counts>,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let directory = tempfile::tempdir_in(env!("CARGO_TARGET_TMPDIR")).unwrap();
        let root = dunce::canonicalize(directory.path()).unwrap();
        let counts = Arc::new(Counts::default());
        let clock = Arc::new(SystemClock::new());
        let pool = Arc::new(CapturedPool {
            calls: Mutex::new(vec![]),
            inner: Arc::new(
                Pool::new(
                    Arc::new(NodeFactory::new(
                        Arc::new(SystemProcessGroups),
                        clock.clone(),
                        counts.clone(),
                        Arc::new(SystemMemory),
                    )),
                    clock,
                    Launch {
                        capture_durability: false,
                        node: "node".into(),
                        entry: workspace().join("packages/mokly/dist/sidecar.js"),
                        repository: root.clone(),
                        version: package_version::read(),
                    },
                    PoolOptions {
                        size: 1.try_into().unwrap(),
                        timeout_ms: None,
                    },
                )
                .with_bundle_store(Arc::new(Unimock::new((
                    BundleStoreMock::load
                        .each_call(matching!(_))
                        .returns(ReadOutcome::Miss(ReadMiss::Absent)),
                    BundleStoreMock::save
                        .each_call(matching!(_))
                        .returns(WriteOutcome::Written),
                )))),
            ),
        });
        let runtime = Runtime::new(
            Arc::new(WorkingTree),
            Arc::new(WorkingTree),
            Arc::new(SystemPhysicalInputs),
            pool.clone(),
            Arc::new(MemoryCache::new(1024 * 1024, 0)),
            Arc::new(ThreadWorkers::new(1).unwrap()),
            package_version::read(),
            None,
        )
        .with_serve_edit_plans();
        let fixture = Self {
            _directory: directory,
            root,
            runtime,
            pool,
            counts,
        };
        fixture.write("package.json", "{}");
        fixture.write("tsconfig.json", r#"{"compilerOptions":{"strict":true}}"#);
        fixture.write("entry.ts", "export {value} from './value';");
        fixture.write("value.ts", "export const value='original';");
        fixture
    }

    pub(super) fn root(&self) -> &Path {
        &self.root
    }

    pub(super) fn write(&self, path: &str, text: &str) {
        let path = self.root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    pub(super) fn prepare(&self) -> Vec<String> {
        let config = ResolvedConfig {
            input: Config::default(),
            file: self.root.join("mokly.config.json"),
            repo_root: self.root.clone(),
            modules: Default::default(),
            authored_inputs: vec![],
            roots: vec![],
        };
        let files = [SourceFile {
            path: "entry.ts".into(),
            absolute: self.root.join("entry.ts"),
            identity: "entry.ts".into(),
            root_index: 0,
            kind: SourceKind::Module,
            excluded: false,
        }];
        self.runtime
            .describe(&config, &files)
            .unwrap()
            .generation
            .unwrap()
            .modules
            .into_keys()
            .collect()
    }

    pub(super) fn edit(&mut self) {
        self.runtime.bundle_capture = BundleCapture::ServeEdit;
    }
    pub(super) fn attempts(&self) -> usize {
        self.counts.0.load(Ordering::SeqCst)
    }
    pub(super) fn sent_plan(&self) -> bool {
        self.pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find_map(|call| match call {
                Call::Bundle(request) => Some(request.plan.is_some()),
                _ => None,
            })
            .unwrap()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.pool.inner.shutdown().unwrap();
    }
}
