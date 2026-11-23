//! Minimal real-sidecar fixture with a Serve-head owner and physical evidence checks.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, MutexGuard};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::definition_provider::DefinitionProvider;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_catalogue::error::Result;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::cache::MemoryCache;
use mokly_graph::workers::ThreadWorkers;
use mokly_render::physical_inputs::SystemPhysicalInputs;
use mokly_render::runtime::Runtime;
use mokly_sidecar::methods::BundleCapture;
use mokly_sidecar::pool::SidecarPool;
use mokly_test_support::durable_fixture::{self, Owner};
use tempfile::TempDir;

use super::plan_capture::InitialCapture;
use super::plan_results::{Counts, Results};
use super::support::package_version;

static FIXTURE: Mutex<()> = Mutex::new(());

pub(super) struct Fixture {
    _directory: TempDir,
    root: PathBuf,
    pub(super) runtime: Runtime,
    pub(super) config: Config,
    pool: Arc<Results>,
    counts: Arc<Counts>,
    _guard: MutexGuard<'static, ()>,
}

impl Fixture {
    pub(super) fn new() -> Self {
        let guard = FIXTURE.lock().unwrap_or_else(|error| error.into_inner());
        let directory = durable_fixture::create(Owner::RenderPlanCandidates).unwrap();
        Self::in_directory(directory, guard)
    }

    pub(super) fn in_parent(parent: &Path) -> Self {
        let guard = FIXTURE.lock().unwrap_or_else(|error| error.into_inner());
        let directory = tempfile::tempdir_in(parent).unwrap();
        Self::in_directory(directory, guard)
    }

    fn in_directory(directory: TempDir, guard: MutexGuard<'static, ()>) -> Self {
        let root = dunce::canonicalize(directory.path()).unwrap();
        let counts = Arc::new(Counts::default());
        let pool = Arc::new(Results::new(&root, counts.clone()));
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
            config: Config::default(),
            pool,
            counts,
            _guard: guard,
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
        self.prepare_entries(&["entry.ts"])
    }

    pub(super) fn prepare_entries(&self, entries: &[&str]) -> Vec<String> {
        self.try_prepare(entries).unwrap()
    }

    pub(super) fn try_prepare(&self, entries: &[&str]) -> Result<Vec<String>> {
        let config = ResolvedConfig {
            input: self.config.clone(),
            file: self.root.join("mokly.config.json"),
            repo_root: self.root.clone(),
            modules: Default::default(),
            authored_inputs: vec![],
            roots: vec![],
        };
        let files: Vec<_> = entries
            .iter()
            .map(|file| SourceFile {
                path: (*file).into(),
                absolute: self.root.join(file),
                identity: (*file).into(),
                root_index: 0,
                kind: SourceKind::Module,
                excluded: false,
            })
            .collect();
        Ok(self
            .runtime
            .describe(&config, &files)?
            .generation
            .unwrap()
            .modules
            .into_keys()
            .collect())
    }

    pub(super) fn assert_native(&self) {
        self.pool.assert_native(&self.root);
    }

    pub(super) fn edit(&mut self) {
        self.runtime.bundle_capture = BundleCapture::ServeEdit;
    }
    pub(super) fn attempts(&self) -> usize {
        self.counts.0.load(Ordering::SeqCst)
    }
    pub(super) fn sent_plan(&self) -> bool {
        self.pool.inner.sent_plan()
    }
    pub(super) fn initial_capture(&self) -> Option<InitialCapture> {
        self.pool.inner.initial_capture()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.pool.shutdown().unwrap();
    }
}
