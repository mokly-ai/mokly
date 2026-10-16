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
        lexical_allowed: None,
        roots: vec![root.join("specs")],
        inputs: vec![root.join("config.json"), root.join("package.json")],
    }
}
#[test]
fn refuses_source_roots_repository_ancestors_and_private_names() {
    let temporary = TempDir::new().unwrap();
    let root = Canonical(dunce::canonicalize(temporary.path()).unwrap());
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
    let temporary = TempDir::new().unwrap();
    let root = Canonical(dunce::canonicalize(temporary.path()).unwrap());
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
    let temporary = TempDir::new().unwrap();
    let root = Canonical(dunce::canonicalize(temporary.path()).unwrap());
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

struct Canonical(std::path::PathBuf);
impl Canonical {
    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

#[cfg(unix)]
#[test]
fn an_absolute_output_through_a_repository_alias_checks_like_with_like() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let alias_parent = TempDir::new().unwrap();
    let alias = alias_parent.path().join("repository");
    std::os::unix::fs::symlink(&root, &alias).unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    let transaction = writer.open(&alias.join("site"), boundary(&root)).unwrap();
    assert_eq!(transaction.output(), root.join("site"));
    transaction.abandon().unwrap();
}

#[test]
fn a_raw_temporary_root_uses_the_canonical_repository_boundary() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    let transaction = writer
        .open(&temporary.path().join("site"), boundary(&root))
        .unwrap();
    assert_eq!(transaction.output(), root.join("site"));
    transaction.abandon().unwrap();
}

#[cfg(unix)]
#[test]
fn repository_aliases_keep_outer_protections_and_detect_retargeting() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let alias_parent = TempDir::new().unwrap();
    let alias = alias_parent.path().join("repository");
    let outside = TempDir::new().unwrap();
    fs::create_dir_all(root.join("node_modules/x")).unwrap();
    fs::create_dir_all(root.join("specs")).unwrap();
    fs::create_dir_all(root.join(".git")).unwrap();
    std::os::unix::fs::symlink(&root, &alias).unwrap();
    std::os::unix::fs::symlink(&root, root.join("node_modules/x/self")).unwrap();
    let writer: &dyn Transactions = &OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    for suffix in [
        "",
        ".git/site",
        "node_modules/site",
        "specs/site",
        "node_modules/x/self/site",
    ] {
        assert!(
            writer.open(&alias.join(suffix), boundary(&root)).is_err(),
            "{suffix}"
        );
    }
    let mut transaction = writer.open(&alias.join("site"), boundary(&root)).unwrap();
    fs::remove_file(&alias).unwrap();
    std::os::unix::fs::symlink(outside.path(), &alias).unwrap();
    assert!(transaction.protect(vec![]).is_err());
    transaction.abandon().unwrap();
    assert!(!outside.path().join("site").exists());
}
