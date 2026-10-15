//! Missing repository-owned source packages cannot resolve through head dependencies.

use std::collections::BTreeMap;
use std::fs;
use std::sync::Arc;

use mokly_compare::cache_types::Cache;
use mokly_compare::inputs::Inputs;
use mokly_compare::overlay::{CachedOverlays, Overlays};
use mokly_git::identity::RepoPath;

use support::{cache, storage};

#[expect(dead_code, reason = "Host fixtures also support other cache targets.")]
mod support;

#[test]
fn a_declared_local_directory_missing_from_the_base_is_not_omitted() {
    let temporary = tempfile::tempdir().unwrap();
    let source = temporary.path().canonicalize().unwrap().join("source");
    fs::create_dir(&source).unwrap();
    let inputs = Inputs {
        objects: BTreeMap::new(),
        files: BTreeMap::from([(
            RepoPath::parse("package.json").unwrap(),
            br#"{"dependencies":{"owned":"file:missing-directory"}}"#.to_vec(),
        )]),
    };
    let cache: Arc<dyn Cache> = Arc::new(cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    ));
    let overlays: &dyn Overlays = &CachedOverlays {
        cache,
        storage: storage(temporary.path()),
    };
    assert!(overlays.acquire(&inputs, &source, "base-commit").is_err());
}
