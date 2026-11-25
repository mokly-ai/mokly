//! Real sidecar composition for the disk-backed bundle pool scenarios.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_compare::bundle_store::CachedBundles;
use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::methods::{Bundle, BundleCapture, BundleRequest, Call};
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::resolution_plan::ResolutionPlan;
use mokly_sidecar::results;
use mokly_sidecar::workers::Diagnostics;

use super::bundle_pool_observations::cache_files;
use super::bundle_pool_trace::{TraceFactory, TraceStore};
use super::{package_version, support};

/// Actual esbuild operations reported by the real sidecar.
#[derive(Default)]
pub(super) struct Counts(
    /// Accumulated esbuild operation count.
    pub(super) AtomicUsize,
);
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

/// Compose one real worker with its real disk bundle store.
pub(super) fn pool(source: &Path, cache: &Path, counts: Arc<Counts>) -> Pool {
    let clock = Arc::new(SystemClock::new());
    let workspace =
        dunce::canonicalize(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")).unwrap();
    Pool::new(
        Arc::new(TraceFactory::new(Arc::new(NodeFactory::new(
            Arc::new(SystemProcessGroups),
            clock.clone(),
            counts,
            Arc::new(SystemMemory),
        )))),
        clock,
        Launch {
            capture_durability: false,
            node: "node".into(),
            entry: workspace.join("crates/mokly-compare/tests/support/bundle_pool_sidecar.mjs"),
            repository: source.into(),
            version: package_version::read(),
        },
        PoolOptions {
            size: 1.try_into().unwrap(),
            timeout_ms: None,
        },
    )
    .with_bundle_store(Arc::new(TraceStore::new(Arc::new(CachedBundles::new(
        Arc::new(support::cache(cache.into(), 1)),
        package_version::read(),
    )))))
}

/// Request a full captured bundle through the pool.
pub(super) fn bundle(pool: &Pool, source: &Path) -> results::Bundle {
    let result = pool
        .request(Call::Bundle(BundleRequest {
            preparation: None,
            plan: None,
            params: Bundle {
                vite: false,
                evaluation: None,
                entry_files: vec!["entry.ts".into()],
                renderer: None,
                stories_files: vec![],
                storybook_folders: Default::default(),
                source_root: source.to_string_lossy().into_owned(),
                configuration_directory: ".".into(),
                repository_roots: vec![],
                module_resolution: Default::default(),
            },
            capture: None,
        }))
        .unwrap()
        .into_bundle();
    eprintln!(
        "bundle result source={}: {}",
        source.display(),
        capture_flags(&result)
    );
    result
}

/// Request a Serve edit with the supplied saved plan.
pub(super) fn edit(
    pool: &Pool,
    source: &Path,
    plan: Option<Arc<ResolutionPlan>>,
) -> results::Bundle {
    let result = pool
        .request(Call::Bundle(BundleRequest {
            preparation: None,
            plan,
            capture: Some(BundleCapture::ServeEdit),
            params: Bundle {
                vite: false,
                evaluation: None,
                entry_files: vec!["entry.ts".into()],
                renderer: None,
                stories_files: vec![],
                storybook_folders: Default::default(),
                source_root: source.to_string_lossy().into_owned(),
                configuration_directory: ".".into(),
                repository_roots: vec![],
                module_resolution: Default::default(),
            },
        }))
        .unwrap()
        .into_bundle();
    eprintln!(
        "edit result source={}: {}",
        source.display(),
        capture_flags(&result)
    );
    result
}

/// Normalize run-specific identities before comparing the complete outputs.
pub(super) fn edit_fingerprint(mut result: results::Bundle) -> Vec<u8> {
    result.generation = "fresh edit".into();
    let compiled = Arc::make_mut(&mut result.compiled);
    compiled.code = compiled
        .code
        .replace(&compiled.runtime_key, "mokly:runtime");
    compiled.runtime_key = "mokly:runtime".into();
    compiled.identity = "fresh edit".into();
    serde_json::to_vec(&result).unwrap()
}

/// Read the actual capture prerequisites without retaining extra state.
pub(super) fn capture_flags(result: &results::Bundle) -> String {
    let evidence = &result.compiled.reuse_evidence;
    format!(
        "cache={:?}, complete={}, durable={}, uncaptured={:?}, plan_imports={:?}, toolchain={}, generation={}, runtime={}",
        result.cache,
        evidence.complete,
        evidence.durable,
        evidence.uncaptured,
        result.plan.as_ref().map(|plan| plan.imports.len()),
        !result.compiled.toolchain.is_empty(),
        result.generation,
        result.compiled.runtime_key,
    )
}

/// List the actual cache files without turning a diagnostic read into a test failure.
pub(super) fn cache_snapshot(cache: &Path) -> String {
    format!("root={}, files={:?}", cache.display(), cache_files(cache))
}
