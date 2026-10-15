//! Real output confinement includes roots, aliases, runtime names, and input ancestors.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_platform::rename::SystemRename;
use mokly_static::filesystem::SystemFiles;
use mokly_static::location::Boundary;
use mokly_static::transaction::{OutputTransactions, Transactions};
use tempfile::TempDir;

fn boundary(root: &Path) -> Boundary {
    Boundary {
        allowed: root.into(),
        roots: vec![root.join("specs")],
        inputs: vec![root.join("config.json"), root.join("package.json")],
    }
}
#[test]
fn refuses_source_roots_repository_ancestors_and_private_names() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    for path in [
        ".",
        "specs",
        "specs/site",
        "node_modules/site",
        ".git/site",
        ".mokly-export-reservations/site",
        "../escape",
    ] {
        assert!(
            writer
                .open(&root.path().join(path), boundary(root.path()))
                .is_err(),
            "{path}"
        );
    }
    let transaction = writer
        .open(&root.path().join("nested/output"), boundary(root.path()))
        .unwrap();
    transaction.abandon().unwrap();
}

#[cfg(unix)]
#[test]
fn confined_aliases_pin_the_real_destination_and_retargeting_is_detected() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("owned")).unwrap();
    fs::create_dir(root.path().join("other")).unwrap();
    std::os::unix::fs::symlink(root.path().join("owned"), root.path().join("alias")).unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    let mut transaction = writer
        .open(&root.path().join("alias/site"), boundary(root.path()))
        .unwrap();
    assert_eq!(transaction.output(), root.path().join("owned/site"));
    fs::remove_file(root.path().join("alias")).unwrap();
    std::os::unix::fs::symlink(root.path().join("other"), root.path().join("alias")).unwrap();
    assert!(transaction.protect(vec![]).is_err());
    transaction.abandon().unwrap();
    assert!(!root.path().join("other/site").exists());
}

#[cfg(unix)]
#[test]
fn rejects_output_symlinks_and_escape_aliases_including_dangling_links() {
    let root = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    std::os::unix::fs::symlink(outside.path(), root.path().join("escape")).unwrap();
    std::os::unix::fs::symlink(root.path().join("missing"), root.path().join("dangling")).unwrap();
    for path in ["escape/site", "escape", "dangling"] {
        assert!(
            writer
                .open(&root.path().join(path), boundary(root.path()))
                .is_err()
        );
    }
}
