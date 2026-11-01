//! Shared PostCSS adapter fixtures with a mocked pool and source tree.

use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_sidecar::methods::ModuleResolution;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::postcss_evidence::Evidence;
use mokly_sidecar::results::Css;
use mokly_sidecar::wire::MethodResult;
use mokly_source_interface::tree::SourceTree;
use unimock::Unimock;

use crate::leases::ContextLease;
use crate::postcss::PostCss;
use crate::postcss_cache::CssCache;
use crate::side::SideInputs;

/// Polling deadline for an expected state; a passing test never waits for it.
pub(super) const DEADLINE: Duration = Duration::from_secs(30);

pub(super) fn css(modules: Vec<String>) -> MethodResult {
    MethodResult::Css(Css {
        read_evidence: Evidence {
            coverage: Default::default(),
            reads: Vec::new(),
            modules,
        },
        unmapped_dependency_directories: None,
        text: "a{}".into(),
        dependencies: Vec::new(),
    })
}

pub(super) fn processor(pool: Arc<dyn SidecarPool>, tree: Arc<dyn SourceTree>) -> PostCss {
    PostCss {
        usage: Arc::new(Unimock::new(())),
        lease: Arc::new(ContextLease {
            id: "context".into(),
            pool: pool.clone(),
            released: CssCache::default().releases,
            used: AtomicBool::new(false),
        }),
        pool,
        tree,
        inventory_tree: Arc::new(Unimock::new(())),
        root: "/repo".into(),
        side: SideInputs {
            dependency_aliases: Default::default(),
            source_root: "/repo".into(),
            repository_roots: vec!["/repo".into()],
            module_resolution: ModuleResolution::default(),
            configuration_directory: String::new(),
            context: "context".into(),
            dependency_roots: Vec::new(),
        },
        module: "postcss.mjs".into(),
        cache: Arc::new(Mutex::new(CssCache::default())),
        resolver: Arc::new(Unimock::new(())),
        turns: Default::default(),
        module_digests: Default::default(),
    }
}
