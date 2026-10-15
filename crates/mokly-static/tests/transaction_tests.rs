//! Real filesystem replacement and adversarial exclusive-rename races.

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
fn factory(rename: Arc<dyn Rename>) -> OutputTransactions {
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
fn artifact(output: &Path, bytes: &'static [u8]) -> Artifact {
    Artifact::finalize(
        output.into(),
        vec![File {
            path: "index.html".into(),
            bytes: bytes.into(),
        }],
        None,
    )
    .unwrap()
}
fn install(root: &Path, bytes: &'static [u8]) {
    let factory: &dyn Transactions = &factory(Arc::new(SystemRename));
    let transaction = factory.open(&root.join("site"), boundary(root)).unwrap();
    transaction
        .stage(&artifact(transaction.output(), bytes), &never())
        .unwrap();
    transaction.install(&never()).unwrap();
}

#[test]
fn replacement_is_complete_and_the_namespace_has_no_active_lock() {
    let root = TempDir::new().unwrap();
    install(root.path(), b"old");
    install(root.path(), b"new");
    assert_eq!(
        fs::read(root.path().join("site/index.html")).unwrap(),
        b"new"
    );
    assert_eq!(
        fs::read_dir(root.path().join(".mokly-export-reservations/locks"))
            .unwrap()
            .count(),
        0
    );
    assert_eq!(
        fs::read(root.path().join(".mokly-export-reservations/.owner")).unwrap(),
        b"mokly-export-reservations-v1\n"
    );
}

#[test]
fn ownership_rejects_unlisted_files_empty_directories_and_bad_markers() {
    for extra in ["file", "directory", "marker"] {
        let root = TempDir::new().unwrap();
        install(root.path(), b"old");
        let site = root.path().join("site");
        match extra {
            "file" => fs::write(site.join("private"), b"keep").unwrap(),
            "directory" => fs::create_dir(site.join("private")).unwrap(),
            _ => fs::write(
                site.join(".mokly-export-artifact"),
                b"{\"schemaVersion\":2}",
            )
            .unwrap(),
        }
        assert!(
            factory(Arc::new(SystemRename))
                .open(&site, boundary(root.path()))
                .is_err()
        );
        assert_eq!(fs::read(site.join("index.html")).unwrap(), b"old");
    }
}

#[test]
fn missing_owned_files_are_allowed_but_competing_writers_are_not() {
    let root = TempDir::new().unwrap();
    install(root.path(), b"old");
    fs::remove_file(root.path().join("site/index.html")).unwrap();
    let factory = factory(Arc::new(SystemRename));
    let transaction = factory
        .open(&root.path().join("site"), boundary(root.path()))
        .unwrap();
    assert!(matches!(
        factory.open(transaction.output(), boundary(root.path())),
        Err(Error::Reserved { .. })
    ));
    transaction.abandon().unwrap();
    transaction.abandon().unwrap();
    install(root.path(), b"new");
}

#[test]
fn cancellation_after_capture_restores_the_exact_earlier_output() {
    let root = TempDir::new().unwrap();
    install(root.path(), b"old");
    let transaction = factory(Arc::new(SystemRename))
        .open(&root.path().join("site"), boundary(root.path()))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"new"), &never())
        .unwrap();
    assert!(matches!(
        transaction.install(&Cancel(AtomicUsize::new(2))),
        Err(Error::Cancelled)
    ));
    assert_eq!(
        fs::read(root.path().join("site/index.html")).unwrap(),
        b"old"
    );
    assert_eq!(
        fs::read_dir(root.path().join(".mokly-export-reservations/locks"))
            .unwrap()
            .count(),
        0
    );
}

struct Race {
    mutation: &'static str,
}
impl Rename for Race {
    fn exclusive(&self, source: &Path, destination: &Path) -> mokly_platform::error::Result<()> {
        if source.file_name().unwrap() == "stage" {
            if self.mutation == "destination" {
                fs::create_dir(destination).unwrap();
            }
            return Err(mokly_platform::error::Error::DestinationExists {
                path: destination.into(),
            });
        }
        SystemRename.exclusive(source, destination)?;
        if destination.file_name().unwrap() == "backup" && self.mutation == "capture" {
            fs::write(destination.join("unowned"), b"keep").unwrap();
        }
        Ok(())
    }
}

#[test]
fn failed_install_restores_but_never_overwrites_a_late_destination() {
    for mutation in ["restore", "destination", "capture"] {
        let root = TempDir::new().unwrap();
        install(root.path(), b"old");
        let transaction = factory(Arc::new(Race { mutation }))
            .open(&root.path().join("site"), boundary(root.path()))
            .unwrap();
        transaction
            .stage(&artifact(transaction.output(), b"new"), &never())
            .unwrap();
        let error = transaction.install(&never()).unwrap_err();
        let backup = root
            .path()
            .join(".mokly-export-reservations/locks/site/backup");
        if mutation == "destination" {
            assert!(matches!(error, Error::Recovery { .. }));
            assert_eq!(fs::read_dir(root.path().join("site")).unwrap().count(), 0);
            assert_eq!(fs::read(backup.join("index.html")).unwrap(), b"old");
        } else {
            assert_eq!(
                fs::read(root.path().join("site/index.html")).unwrap(),
                b"old"
            );
            assert!(!backup.exists());
            if mutation == "capture" {
                assert_eq!(fs::read(root.path().join("site/unowned")).unwrap(), b"keep");
            }
        }
    }
}

#[test]
fn output_appearing_after_initial_absence_is_never_adopted() {
    let root = TempDir::new().unwrap();
    let site = root.path().join("site");
    let transaction = factory(Arc::new(SystemRename))
        .open(&site, boundary(root.path()))
        .unwrap();
    transaction
        .stage(&artifact(&site, b"new"), &never())
        .unwrap();
    fs::create_dir(&site).unwrap();
    assert!(matches!(
        transaction.install(&never()),
        Err(Error::Replaced { .. })
    ));
    assert_eq!(fs::read_dir(site).unwrap().count(), 0);
}

#[test]
fn untrusted_inventory_cannot_write_outside_its_stage() {
    let root = TempDir::new().unwrap();
    let site = root.path().join("site");
    let transaction = factory(Arc::new(SystemRename))
        .open(&site, boundary(root.path()))
        .unwrap();
    let mut artifact = artifact(&site, b"new");
    artifact.files[0].path = "../escape".into();
    assert!(matches!(
        transaction.stage(&artifact, &never()),
        Err(Error::Portable { .. })
    ));
    transaction.abandon().unwrap();
    assert!(!site.exists());
}
