//! Native CLI composition of the shared JavaScript and HTML rendering services.

use std::env;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::capture_workers::{CaptureWorkers, PoolCaptureCapacity};
use mokly_cli::grammar::{Common, SidecarSource};
use mokly_cli::version::VERSION;
use mokly_compare::cache_types::Reporter;
use mokly_compare::node_executable::{NodeExecutable, SystemNodeExecutable};
use mokly_graph::cache::{MemoryCache, RenderCache};
use mokly_graph::error::Result;
use mokly_graph::workers::{RenderWorkers, ThreadWorkers};
use mokly_platform::processes::SystemProcessGroups;
use mokly_render::physical_inputs::SystemPhysicalInputs;
use mokly_render::runtime::Runtime;
#[cfg(target_os = "linux")]
use mokly_sidecar::cgroup_memory::{CgroupMemory, SystemMemoryFiles};
#[cfg(not(target_os = "linux"))]
use mokly_sidecar::host_memory::NoMemoryLimits;
use mokly_sidecar::host_memory::{HostMemory, MemoryEstimate, MemoryLimits, SysinfoMemory};
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_admission::PoolCapacity;
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::Diagnostics;
use mokly_source_interface::tree::SourceTree;

use crate::bundle_runtime::{self, Reporting};

/// Shared capacity for full artifacts and compact documents.
const RENDER_CACHE_BYTES: usize = 256 * 1024 * 1024;

/// Compact documents take at most half of the shared capacity.
const COMPACT_RENDER_CACHE_CEILING: usize = 128 * 1024 * 1024;

/// Create the one render cache of a command. Both sides and the timing layer share it.
pub(super) fn cache() -> Arc<dyn RenderCache> {
    Arc::new(MemoryCache::new(
        RENDER_CACHE_BYTES,
        COMPACT_RENDER_CACHE_CEILING,
    ))
}

/// One command's request and capacity capabilities share the same process pool.
pub(super) trait CommandPool: SidecarPool + PoolCapacity {}

impl CommandPool for Pool {}

pub(super) struct Services {
    pub(super) runtime: Arc<Runtime>,
    pub(super) pool: Arc<dyn CommandPool>,
    pub(super) reporter: Arc<dyn Reporter>,
}

impl Services {
    #[expect(
        clippy::too_many_arguments,
        reason = "the composition root passes independent runtime seams"
    )]
    pub(super) fn new(
        tree: Arc<dyn SourceTree>,
        cwd: &Path,
        repository: &Path,
        common: &Common,
        diagnostics: Arc<dyn Diagnostics>,
        cancellation: Arc<dyn Cancellation>,
        cache: Arc<dyn RenderCache>,
        reporting: Reporting,
    ) -> Result<Self> {
        let clock = Arc::new(SystemClock::new());
        let size = common.sidecars.and_then(NonZeroUsize::new).expect(
            "CLI option normalization sets a positive sidecar count before runtime creation",
        );
        let reporter = reporting.directory.clone();
        let bundles = bundle_runtime::store(
            repository,
            cancellation.clone(),
            reporting,
            diagnostics.clone(),
        );
        let pool = Pool::new(
            Arc::new(
                NodeFactory::new(
                    Arc::new(SystemProcessGroups),
                    clock.clone(),
                    diagnostics.clone(),
                    Arc::new(SystemMemory),
                )
                .with_timings(common.debug_timings),
            ),
            clock,
            Launch {
                capture_durability: false,
                node: SystemNodeExecutable.resolve().unwrap_or_else(|_| {
                    env::var_os("MOKLY_NODE_EXECUTABLE")
                        .map_or_else(|| PathBuf::from("node"), PathBuf::from)
                }),
                entry: sidecar_entry(cwd),
                repository: repository.to_owned(),
                version: VERSION.into(),
            },
            PoolOptions {
                size,
                timeout_ms: common.sidecar_timeout_ms,
            },
        )
        .with_bundle_store(bundles);
        #[cfg(debug_assertions)]
        let pool = test_render_deadline(pool);
        let pool: Arc<dyn CommandPool> = Arc::new(match common.sidecar_source {
            SidecarSource::Default => pool.with_memory_admission(memory()),
            SidecarSource::Explicit => pool,
        });
        let workers: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(
            std::thread::available_parallelism().map_or(1, usize::from),
        )?);
        let workers: Arc<dyn RenderWorkers> = Arc::new(CaptureWorkers {
            inner: workers.clone(),
            capture: workers,
            capacity: Arc::new(PoolCaptureCapacity { pool: pool.clone() }),
        });
        let runtime = runtime(tree, pool.clone(), workers, cancellation, cache);
        Ok(Self {
            runtime,
            pool,
            reporter,
        })
    }
}

/// Debug builds only: `MOKLY_TEST_SIDECAR_RENDER_TIMEOUT_MS` replaces the
/// deadline of every render call, so the process test of a hanging render
/// does not wait two real deadlines. Release builds compile no read of this
/// variable, so they always keep the production deadlines.
#[cfg(debug_assertions)]
fn test_render_deadline(pool: Pool) -> Pool {
    match env::var("MOKLY_TEST_SIDECAR_RENDER_TIMEOUT_MS")
        .ok()
        .and_then(|value| value.parse().ok())
    {
        Some(deadline_ms) => pool.with_test_render_deadline(deadline_ms),
        None => pool,
    }
}

fn memory() -> Arc<dyn HostMemory> {
    #[cfg(target_os = "linux")]
    let limits: Arc<dyn MemoryLimits> = Arc::new(CgroupMemory::new(Arc::new(SystemMemoryFiles)));
    #[cfg(not(target_os = "linux"))]
    let limits: Arc<dyn MemoryLimits> = Arc::new(NoMemoryLimits);
    Arc::new(MemoryEstimate::new(
        Arc::new(SysinfoMemory::default()),
        limits,
    ))
}

/// Build the head runtime over the command's render cache and cancellable workers. The
/// base side builds its runtime from the same pool, cache, and workers, so both sides
/// share one sidecar pool, one render cache, and the command's cancellation.
fn runtime(
    tree: Arc<dyn SourceTree>,
    pool: Arc<dyn SidecarPool>,
    workers: Arc<dyn RenderWorkers>,
    cancellation: Arc<dyn Cancellation>,
    cache: Arc<dyn RenderCache>,
) -> Arc<Runtime> {
    Arc::new(Runtime::new(
        tree.clone(),
        tree,
        Arc::new(SystemPhysicalInputs),
        pool,
        cache,
        Arc::new(CancellableWorkers {
            inner: workers,
            cancellation,
        }),
        VERSION.into(),
        None,
    ))
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
