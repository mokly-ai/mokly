//! Disk recipes must observe earlier interpolated paths targets after restart.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_compare::bundle_store::CachedBundles;
use mokly_sidecar::bundle_outcomes::CacheOutcome;
use mokly_sidecar::pool::{Pool, SidecarPool};

#[path = "../../../tests/rust/config_dir.rs"]
mod config_dir;

#[expect(
    dead_code,
    reason = "cache composition is shared with the other integration tests"
)]
mod support;

fn cached_pool(source: &Path, cache: &Path, counts: Arc<config_dir::Counts>) -> Pool {
    config_dir::pool(source, counts).with_bundle_store(Arc::new(CachedBundles::new(
        Arc::new(support::cache(cache.into(), 1)),
        config_dir::package_version::read(),
    )))
}

#[test]
fn restarted_disk_recipes_reject_an_added_earlier_config_dir_paths_target() {
    let scratch = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.context");
    fs::create_dir_all(&scratch).unwrap();
    let temporary = tempfile::tempdir_in(scratch).unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let source = root.join("source");
    let cache = root.join("cache");
    config_dir::fixture(&source);
    fs::create_dir(&cache).unwrap();
    let first_counts = Arc::new(config_dir::Counts::default());
    let first = cached_pool(&source, &cache, first_counts.clone());
    let original = config_dir::bundle(&first, &source);
    assert_eq!(
        config_dir::module_names(&original),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(first_counts.0.load(Ordering::SeqCst), 1);
    first.shutdown().unwrap();

    let warm_counts = Arc::new(config_dir::Counts::default());
    let warm = cached_pool(&source, &cache, warm_counts.clone());
    let unchanged = config_dir::bundle(&warm, &source);
    assert_eq!(
        config_dir::module_names(&unchanged),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(unchanged.cache, Some(CacheOutcome::Hit));
    assert_eq!(warm_counts.0.load(Ordering::SeqCst), 0);
    warm.shutdown().unwrap();
    config_dir::add_earlier(&source);

    let native_counts = Arc::new(config_dir::Counts::default());
    let oracle = config_dir::pool(&source, native_counts.clone());
    let native = config_dir::bundle(&oracle, &source);
    assert_eq!(
        config_dir::module_names(&native),
        ["entry.ts", "one/value.js"]
    );
    assert_eq!(native_counts.0.load(Ordering::SeqCst), 1);
    oracle.shutdown().unwrap();

    let counts = Arc::new(config_dir::Counts::default());
    let restarted = cached_pool(&source, &cache, counts.clone());
    let changed = config_dir::bundle(&restarted, &source);
    assert_eq!(
        config_dir::module_names(&changed),
        config_dir::module_names(&native),
        "restarted disk reuse must match fresh native selection"
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    restarted.shutdown().unwrap();
}
