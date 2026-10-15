//! Native CLI composition of the shared JavaScript and HTML rendering services.

use std::env;
use std::io::{self, Write};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::grammar::Common;
use mokly_cli::redaction::Redactor;
use mokly_cli::version::VERSION;
use mokly_graph::cache::MemoryCache;
use mokly_graph::error::Result;
use mokly_graph::workers::{RenderWorkers, ThreadWorkers};
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::Diagnostics;
use mokly_source_interface::tree::SourceTree;

pub(super) struct Services {
    pub(super) runtime: Arc<Runtime>,
    pub(super) pool: Arc<dyn SidecarPool>,
}

impl Services {
    pub(super) fn new(
        tree: Arc<dyn SourceTree>,
        cwd: &Path,
        repository: &Path,
        common: &Common,
        redactor: Arc<Redactor>,
        cancellation: Arc<dyn Cancellation>,
    ) -> Result<Self> {
        let clock = Arc::new(SystemClock::new());
        let size = common
            .sidecars
            .and_then(NonZeroUsize::new)
            .unwrap_or(NonZeroUsize::MIN);
        let diagnostics: Arc<dyn Diagnostics> = Arc::new(Reporter { redactor });
        let pool: Arc<dyn SidecarPool> = Arc::new(Pool::new(
            Arc::new(NodeFactory::new(
                Arc::new(SystemProcessGroups),
                clock.clone(),
                diagnostics.clone(),
                Arc::new(SystemMemory),
            )),
            clock,
            Launch {
                node: env::var_os("MOKLY_NODE_EXECUTABLE")
                    .map_or_else(|| PathBuf::from("node"), PathBuf::from),
                entry: sidecar_entry(cwd),
                repository: repository.to_owned(),
                version: VERSION.into(),
            },
            PoolOptions {
                size,
                timeout_ms: common.sidecar_timeout_ms,
            },
        ));
        let runtime = runtime(
            tree,
            pool.clone(),
            Arc::new(ThreadWorkers::new(
                std::thread::available_parallelism().map_or(1, usize::from),
            )?),
            cancellation,
        );
        Ok(Self { runtime, pool })
    }
}

fn runtime(
    tree: Arc<dyn SourceTree>,
    pool: Arc<dyn SidecarPool>,
    workers: Arc<dyn RenderWorkers>,
    cancellation: Arc<dyn Cancellation>,
) -> Arc<Runtime> {
    Arc::new(Runtime::new(
        tree.clone(),
        tree,
        pool,
        Arc::new(MemoryCache::new(256 * 1024 * 1024)),
        Arc::new(CancellableWorkers {
            inner: workers,
            cancellation,
        }),
        VERSION.into(),
        None,
    ))
}

struct Reporter {
    redactor: Arc<Redactor>,
}

impl Diagnostics for Reporter {
    fn emit(&self, message: &str) {
        let _ = writeln!(io::stderr().lock(), "{}", self.redactor.safe(message));
    }
}

fn sidecar_entry(cwd: &Path) -> PathBuf {
    if let Some(root) = env::var_os("MOKLY_PACKAGE_ROOT") {
        return PathBuf::from(root).join("dist/sidecar.js");
    }
    let executable = env::current_exe().ok();
    let installed = executable
        .as_deref()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .and_then(Path::parent)
        .map(|scope| scope.join("mokly/dist/sidecar.js"));
    if let Some(entry) = installed.filter(|entry| entry.is_file()) {
        return entry;
    }
    for directory in cwd
        .ancestors()
        .chain(executable.as_deref().into_iter().flat_map(Path::ancestors))
    {
        for entry in [
            directory.join("node_modules/@mokly/mokly/dist/sidecar.js"),
            directory.join("packages/mokly/dist/sidecar.js"),
        ] {
            if entry.is_file() {
                return entry;
            }
        }
    }
    PathBuf::from("@mokly/mokly/dist/sidecar.js")
}

#[cfg(test)]
#[path = "_tests_/runtime_version_tests.rs"]
mod runtime_version_tests;
