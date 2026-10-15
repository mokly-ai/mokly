//! Captured substitutions and post-installation failures preserve recovery material.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::output::artifact::{Artifact, File};
use mokly_platform::rename::{Rename, SystemRename};
use mokly_static::error::Error;
use mokly_static::filesystem::SystemFiles;
use mokly_static::location::Boundary;
use mokly_static::transaction::{Cancellation, OutputTransactions, Transactions};
use tempfile::TempDir;

struct Cancel(AtomicUsize);
impl Cancellation for Cancel {
    fn requested(&self) -> bool {
        self.0.fetch_sub(1, Ordering::SeqCst) == 1
    }
}
fn never() -> Cancel {
    Cancel(AtomicUsize::new(usize::MAX))
}
fn writer(rename: Arc<dyn Rename>) -> OutputTransactions {
    OutputTransactions {
        files: Arc::new(SystemFiles),
        rename,
    }
}
fn boundary(root: &Path) -> Boundary {
    Boundary {
        allowed: root.into(),
        roots: vec![],
        inputs: vec![],
    }
}
fn artifact(output: &Path, text: &'static [u8]) -> Artifact {
    Artifact::finalize(
        output.into(),
        vec![File {
            path: "index.html".into(),
            bytes: text.into(),
        }],
        None,
    )
    .unwrap()
}
fn previous(root: &Path) {
    let transaction = writer(Arc::new(SystemRename))
        .open(&root.join("site"), boundary(root))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"old"), &never())
        .unwrap();
    transaction.install(&never()).unwrap();
}
struct Race(&'static str);
impl Rename for Race {
    fn exclusive(&self, source: &Path, destination: &Path) -> mokly_platform::error::Result<()> {
        if self.0 == "restore" && source.file_name().unwrap() == "backup" {
            fs::create_dir(destination).unwrap();
        }
        if self.0 == "substitute" && destination.file_name().unwrap() == "backup" {
            fs::rename(source, source.with_file_name("retained-original")).unwrap();
            fs::create_dir(source).unwrap();
            fs::write(source.join("unowned"), b"replacement").unwrap();
        }
        SystemRename.exclusive(source, destination)?;
        if self.0 == "cleanup" && source.file_name().unwrap() == "stage" {
            fs::write(source.with_file_name("backup").join("late"), b"keep").unwrap();
        }
        Ok(())
    }
}

#[test]
fn successful_install_is_kept_when_backup_cleanup_fails() {
    let root = TempDir::new().unwrap();
    previous(root.path());
    let transaction = writer(Arc::new(Race("cleanup")))
        .open(&root.path().join("site"), boundary(root.path()))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"new"), &never())
        .unwrap();
    let error = transaction.install(&never()).unwrap_err();
    assert!(matches!(error, Error::Installed { .. }));
    assert!(error.to_string().contains("new site is installed"));
    assert_eq!(
        fs::read(root.path().join("site/index.html")).unwrap(),
        b"new"
    );
    assert_eq!(
        fs::read(
            root.path()
                .join(".mokly-export-reservations/locks/site/backup/late")
        )
        .unwrap(),
        b"keep"
    );
}

#[test]
fn failed_cancellation_restore_is_a_recovery_error_with_both_causes() {
    let root = TempDir::new().unwrap();
    previous(root.path());
    let transaction = writer(Arc::new(Race("restore")))
        .open(&root.path().join("site"), boundary(root.path()))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"new"), &never())
        .unwrap();
    let Error::Recovery {
        primary,
        cleanup,
        path,
    } = transaction
        .install(&Cancel(AtomicUsize::new(2)))
        .unwrap_err()
    else {
        panic!("expected combined recovery failure")
    };
    assert!(matches!(*primary, Error::Cancelled));
    assert!(matches!(*cleanup, Error::Internal(_)));
    assert_eq!(fs::read(path.join("index.html")).unwrap(), b"old");
    assert_eq!(fs::read_dir(root.path().join("site")).unwrap().count(), 0);
}

#[test]
fn a_substitution_at_capture_is_restored_with_its_unowned_bytes() {
    let root = TempDir::new().unwrap();
    previous(root.path());
    let transaction = writer(Arc::new(Race("substitute")))
        .open(&root.path().join("site"), boundary(root.path()))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"new"), &never())
        .unwrap();
    assert!(transaction.install(&never()).is_err());
    assert_eq!(
        fs::read(root.path().join("site/unowned")).unwrap(),
        b"replacement"
    );
    assert_eq!(
        fs::read(root.path().join("retained-original/index.html")).unwrap(),
        b"old"
    );
    assert!(
        !root
            .path()
            .join(".mokly-export-reservations/locks/site")
            .exists()
    );
}
