//! Directory aliases must not change source protection or output pruning.

#![cfg(unix)]

use std::fs;
use std::os::unix::fs::symlink;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::{Discoverer, Discovery};
use mokly_catalogue::working_tree::WorkingTree;
use tempfile::TempDir;

mod support;

#[test]
fn config_file_alias_under_a_repository_alias_keeps_both_source_names() {
    let holder = TempDir::new().unwrap();
    let root = holder.path().join("real");
    support::write(&root, "real-config.json", "{}");
    support::write(&root, "specs/home.md", "# Home");
    symlink("real-config.json", root.join("mokly.config.json")).unwrap();
    let alias = holder.path().join("alias");
    symlink(&root, &alias).unwrap();
    let prepared = support::prepare(&alias, Some("mokly.config.json")).unwrap();
    assert_eq!(
        prepared.model.sources,
        ["mokly.config.json", "real-config.json", "specs/home.md"]
    );
}

#[test]
fn output_pruning_compares_physical_paths_below_aliased_roots() {
    let holder = TempDir::new().unwrap();
    let root = holder.path().join("real");
    support::write(
        &root,
        "mokly.config.json",
        r#"{"roots":[{"dir":"alias-specs"}]}"#,
    );
    support::write(&root, "specs/home.md", "# Home");
    support::write(&root, "specs/output/old.md", "# Old");
    symlink("specs", root.join("alias-specs")).unwrap();
    let alias = holder.path().join("alias");
    symlink(&root, &alias).unwrap();
    let tree = Arc::new(WorkingTree);
    let config = Loader { tree: tree.clone() }
        .load(&alias, Some("mokly.config.json"))
        .unwrap();
    let discovery = Discoverer { tree };
    for output in [
        alias.join("specs/output"),
        alias.join("alias-specs/output"),
        dunce::canonicalize(root.join("specs/output")).unwrap(),
    ] {
        let inventory = discovery.discover(&config, Some(&output)).unwrap();
        assert_eq!(inventory.files.len(), 1, "output: {}", output.display());
        assert_eq!(inventory.files[0].path, "alias-specs/home.md");
    }
    fs::remove_dir_all(root.join("specs/output")).unwrap();
    assert_eq!(
        discovery
            .discover(&config, Some(&alias.join("specs/output")))
            .unwrap()
            .files
            .len(),
        1
    );
}
