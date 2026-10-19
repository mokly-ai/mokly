//! Share one live generation while tests overlap; release it before removing its source.

use std::env;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::version::VERSION;
use mokly_graph::cache::{Artifact, MemoryCache};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_graph::workers::ThreadWorkers;
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::Diagnostics;
use tempfile::TempDir;

use super::fixture;

static SHARED: Mutex<Weak<Catalogue>> = Mutex::new(Weak::new());

/// A prepared generation whose resources drop before its isolated source.
pub(super) struct Catalogue {
    /// Real native and sidecar render path, with lazy document caching.
    pub(super) generation: Arc<dyn RenderGeneration>,
    _stop: StopPool,
    _directory: TempDir,
}

/// Reuse preparation only while another test still owns the generation.
pub(super) fn shared() -> Arc<Catalogue> {
    let mut shared = SHARED.lock().unwrap();
    if let Some(catalogue) = shared.upgrade() {
        return catalogue;
    }
    let catalogue = Arc::new(prepare());
    *shared = Arc::downgrade(&catalogue);
    catalogue
}

fn prepare() -> Catalogue {
    let directory = fixture::copy();
    let root = directory.path();
    let tree = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }
        .load(root, Some("examples/basic/mokly.config.json"))
        .unwrap();
    let clock = Arc::new(SystemClock::new());
    let pool: Arc<dyn SidecarPool> = Arc::new(Pool::new(
        Arc::new(NodeFactory::new(
            Arc::new(SystemProcessGroups),
            clock.clone(),
            Arc::new(ProbeDiagnostics),
            Arc::new(SystemMemory),
        )),
        clock.clone(),
        Launch {
            node: env::var_os("MOKLY_NODE_EXECUTABLE").map_or_else(|| "node".into(), PathBuf::from),
            entry: fixture::workspace().join("packages/mokly/dist/sidecar.js"),
            repository: config.repo_root.clone(),
            version: VERSION.into(),
        },
        PoolOptions {
            size: NonZeroUsize::MIN,
            timeout_ms: None,
        },
    ));
    let stop = StopPool(pool.clone());
    let runtime = Arc::new(Runtime::new(
        tree.clone(),
        tree.clone(),
        pool,
        Arc::new(MemoryCache::new(256 * 1024 * 1024)),
        Arc::new(CancellableWorkers {
            inner: Arc::new(ThreadWorkers::new(4).unwrap()),
            cancellation: Arc::new(BuildCancellation::new(clock)),
        }),
        VERSION.into(),
        None,
    ));
    let catalogue: Arc<dyn CatalogueBuilder> = Arc::new(Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree }),
        definitions: runtime.clone(),
    });
    let prepared = catalogue.prepare(&config, None).unwrap();
    assert!(prepared.warnings.is_empty(), "{:?}", prepared.warnings);
    assert!(prepared.deferred_modules.is_empty());
    let generation = runtime
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None)
        .unwrap();
    Catalogue {
        generation,
        _stop: stop,
        _directory: directory,
    }
}

impl Catalogue {
    /// Render every configured view for one exact catalogue entry.
    pub(super) fn views(&self, path: &str) -> Vec<Arc<Artifact>> {
        let index = self
            .generation
            .catalogue()
            .model
            .entries
            .iter()
            .position(|entry| entry.metadata.path == path)
            .unwrap();
        let views: Vec<_> = self
            .generation
            .plans()
            .values()
            .filter(|plan| plan.entry == index)
            .map(|plan| self.generation.render(&plan.route).unwrap())
            .collect();
        assert!(!views.is_empty(), "{path}");
        views
    }
}

struct StopPool(Arc<dyn SidecarPool>);
impl Drop for StopPool {
    fn drop(&mut self) {
        self.0.shutdown().unwrap();
    }
}

struct ProbeDiagnostics;
impl Diagnostics for ProbeDiagnostics {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
}
