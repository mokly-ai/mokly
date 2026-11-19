//! Released recipes must observe earlier interpolated paths targets.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_sidecar::pool::SidecarPool;

#[path = "../../../tests/rust/config_dir.rs"]
mod config_dir;

#[test]
fn released_recipes_reject_an_added_earlier_config_dir_paths_target() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    config_dir::fixture(&root);
    let counts = Arc::new(config_dir::Counts::default());
    let pool = config_dir::pool(&root, counts.clone());
    let original = config_dir::bundle(&pool, &root);
    assert_eq!(
        config_dir::module_names(&original),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    pool.release_generation(&original.generation, original.epoch);
    let unchanged = config_dir::bundle(&pool, &root);
    assert_eq!(
        unchanged.compiled.runtime_key,
        original.compiled.runtime_key
    );
    assert_eq!(
        config_dir::module_names(&unchanged),
        ["entry.ts", "two/value.js"]
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 1);
    pool.release_generation(&unchanged.generation, unchanged.epoch);
    config_dir::add_earlier(&root);

    let native_counts = Arc::new(config_dir::Counts::default());
    let oracle = config_dir::pool(&root, native_counts.clone());
    let native = config_dir::bundle(&oracle, &root);
    assert_eq!(
        config_dir::module_names(&native),
        ["entry.ts", "one/value.js"]
    );
    assert_eq!(native_counts.0.load(Ordering::SeqCst), 1);
    oracle.shutdown().unwrap();

    let changed = config_dir::bundle(&pool, &root);
    assert_eq!(
        config_dir::module_names(&changed),
        config_dir::module_names(&native),
        "released reuse must match fresh native selection"
    );
    assert_eq!(counts.0.load(Ordering::SeqCst), 2);
    pool.shutdown().unwrap();
}
