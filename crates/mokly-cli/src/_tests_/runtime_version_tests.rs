//! The executable supplies the npm version and the command's cache to the graph runtime.

use std::sync::Arc;

use mokly_cli::cancellation::BuildCancellation;
use mokly_cli::version::VERSION;
use mokly_graph::cache::RenderCache;
use unimock::Unimock;

#[test]
fn graph_runtime_version_equals_the_embedded_npm_version() {
    let runtime = super::runtime(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        Arc::new(Unimock::new(())),
    );
    assert_eq!(runtime.version, VERSION);
}

#[test]
fn graph_runtime_shares_the_command_cache_with_its_other_readers() {
    let cache: Arc<dyn RenderCache> = super::cache();
    let runtime = super::runtime(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        cache.clone(),
    );
    assert!(Arc::ptr_eq(&runtime.cache, &cache));
    assert_eq!(cache.stats().bytes, 0);
}
