//! Symlink substitution never grants deletion or restoration authority.
#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_model::output::artifact::{Artifact, File};
use mokly_platform::rename::{Rename, SystemRename};
use mokly_static::error::Error;
use mokly_static::filesystem::SystemFiles;
use mokly_static::location::Boundary;
use mokly_static::transaction::{Cancellation, OutputTransactions, Transactions};
use tempfile::TempDir;

struct Active;
impl Cancellation for Active {
    fn requested(&self) -> bool {
        false
    }
}
struct Substitute;
impl Rename for Substitute {
    fn exclusive(&self, source: &Path, destination: &Path) -> mokly_platform::error::Result<()> {
        if destination.file_name().unwrap() == "backup" {
            fs::rename(source, source.with_file_name("original")).unwrap();
            std::os::unix::fs::symlink(source.with_file_name("original"), source).unwrap();
        }
        SystemRename.exclusive(source, destination)
    }
}
fn boundary(root: &Path) -> Boundary {
    Boundary {
        allowed: root.into(),
        lexical_allowed: None,
        roots: vec![],
        inputs: vec![],
    }
}
#[test]
fn a_captured_symlink_is_retained_and_never_restored_as_a_directory() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let output = root.join("site");
    let old = Artifact::finalize(
        output.clone(),
        vec![File {
            path: "index.html".into(),
            bytes: b"old".as_slice().into(),
        }],
        None,
    )
    .unwrap();
    fs::create_dir(&output).unwrap();
    for file in &old.files {
        fs::write(output.join(&file.path), &file.bytes).unwrap();
    }
    let writer = OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(Substitute),
    };
    let transaction = writer.open(&output, boundary(&root)).unwrap();
    transaction.stage(&old, &Active).unwrap();
    let Error::Recovery { path, .. } = transaction.install(&Active).unwrap_err() else {
        panic!("recovery required")
    };
    assert!(fs::symlink_metadata(path).unwrap().file_type().is_symlink());
    assert!(!output.exists());
    assert_eq!(fs::read(root.join("original/index.html")).unwrap(), b"old");
}
#[test]
fn symlinked_namespace_owner_and_output_do_not_authorize_a_reservation() {
    for kind in ["namespace", "owner", "output"] {
        let temporary = TempDir::new().unwrap();
        let root = dunce::canonicalize(temporary.path()).unwrap();
        let namespace = root.join(".mokly-export-reservations");
        let output = root.join("site");
        let original = root.join("original");
        fs::create_dir(&original).unwrap();
        fs::write(original.join("keep"), "foreign").unwrap();
        if kind == "namespace" {
            std::os::unix::fs::symlink(&original, &namespace).unwrap();
        } else if kind == "owner" {
            fs::create_dir(&namespace).unwrap();
            std::os::unix::fs::symlink(original.join("keep"), namespace.join(".owner")).unwrap();
        } else {
            std::os::unix::fs::symlink(&original, &output).unwrap();
        }
        let writer = OutputTransactions {
            files: Arc::new(SystemFiles),
            rename: Arc::new(SystemRename),
        };
        assert!(writer.open(&output, boundary(&root)).is_err());
        assert_eq!(fs::read(original.join("keep")).unwrap(), b"foreign");
        assert!(!namespace.join("locks").exists());
    }
}

#[test]
fn concurrent_directory_aliases_admit_only_one_writer_for_the_same_output() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    fs::create_dir(root.join("parent")).unwrap();
    std::os::unix::fs::symlink(root.join("parent"), root.join("alias")).unwrap();
    let factory = OutputTransactions {
        files: Arc::new(SystemFiles),
        rename: Arc::new(SystemRename),
    };
    factory
        .open(&root.join("parent/seed"), boundary(&root))
        .unwrap()
        .abandon()
        .unwrap();
    let mut paths = vec![root.join("parent/site"), root.join("alias/site")];
    if root.join("PARENT").is_dir() {
        paths.push(root.join("PARENT/SITE"));
    }
    let barrier = std::sync::Barrier::new(paths.len());
    let results = std::thread::scope(|scope| {
        let handles: Vec<_> = paths
            .iter()
            .map(|path| {
                scope.spawn(|| {
                    barrier.wait();
                    factory.open(path, boundary(&root))
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>()
    });
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    for result in results {
        match result {
            Ok(transaction) => transaction.abandon().unwrap(),
            Err(error) => assert!(matches!(error, Error::Reserved { .. })),
        }
    }
}
