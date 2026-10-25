//! Exact admission, reservation and destination races use real isolated filesystems.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::output::artifact::{Artifact, File};
use mokly_platform::rename::{Rename, SystemRename};
use mokly_static::error::Error;
use mokly_static::filesystem::SystemFiles;
use mokly_static::location::Boundary;
use mokly_static::transaction::{Cancellation, OutputTransactions, Transactions};
use tempfile::TempDir;

struct Cancel(bool);
impl Cancellation for Cancel {
    fn requested(&self) -> bool {
        self.0
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
fn writer(rename: Arc<dyn Rename>) -> OutputTransactions {
    OutputTransactions {
        files: Arc::new(SystemFiles),
        rename,
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
fn owned(output: &Path, text: &'static [u8]) {
    fs::create_dir(output).unwrap();
    for file in artifact(output, text).files {
        fs::write(output.join(file.path), file.bytes).unwrap();
    }
}
struct Race {
    case: &'static str,
    root: PathBuf,
}
impl Rename for Race {
    fn exclusive(&self, from: &Path, to: &Path) -> mokly_platform::error::Result<()> {
        let capture = to.file_name().unwrap() == "backup";
        if capture && self.case == "before-capture" {
            fs::rename(from, self.root.join("original")).unwrap();
            owned(from, b"other");
        }
        if from.file_name().unwrap() == "stage" && self.case == "install-empty" {
            fs::create_dir(to).unwrap();
        }
        SystemRename.exclusive(from, to)?;
        if capture && self.case == "after-capture" {
            fs::rename(to, self.root.join("original")).unwrap();
            owned(to, b"other");
        }
        if capture && self.case == "competing-and-unowned" {
            fs::create_dir(from).unwrap();
            fs::write(from.join("concurrent"), "keep").unwrap();
            fs::write(to.join("unowned"), "keep").unwrap();
        }
        Ok(())
    }
}
#[test]
fn a_different_owned_output_before_or_after_capture_is_retained() {
    for case in ["before-check", "before-capture", "after-capture"] {
        let temporary = TempDir::new().unwrap();
        let root = dunce::canonicalize(temporary.path()).unwrap();
        let output = root.join("site");
        owned(&output, b"old");
        let transaction = writer(Arc::new(Race {
            case,
            root: root.clone(),
        }))
        .open(&output, boundary(&root))
        .unwrap();
        transaction
            .stage(&artifact(&output, b"new"), &Cancel(false))
            .unwrap();
        if case == "before-check" {
            fs::rename(&output, root.join("original")).unwrap();
            owned(&output, b"other");
        }
        assert!(matches!(
            transaction.install(&Cancel(false)),
            Err(Error::Replaced { .. })
        ));
        assert_eq!(fs::read(output.join("index.html")).unwrap(), b"other");
        assert_eq!(fs::read(root.join("original/index.html")).unwrap(), b"old");
        assert!(!transaction.recovery_path().exists());
    }
}
#[test]
fn empty_install_conflicts_survive_with_and_without_an_earlier_site() {
    for existed in [false, true] {
        let temporary = TempDir::new().unwrap();
        let root = dunce::canonicalize(temporary.path()).unwrap();
        let output = root.join("site");
        if existed {
            owned(&output, b"old");
        }
        let transaction = writer(Arc::new(Race {
            case: "install-empty",
            root: root.clone(),
        }))
        .open(&output, boundary(&root))
        .unwrap();
        transaction
            .stage(&artifact(&output, b"new"), &Cancel(false))
            .unwrap();
        let error = transaction.install(&Cancel(false)).unwrap_err();
        assert_eq!(matches!(error, Error::Recovery { .. }), existed);
        assert!(output.is_dir());
        assert_eq!(fs::read_dir(&output).unwrap().count(), 0);
        if existed {
            assert_eq!(
                fs::read(transaction.recovery_path().join("backup/index.html")).unwrap(),
                b"old"
            );
        } else {
            assert!(!transaction.recovery_path().exists());
        }
    }
}
#[test]
fn concurrent_destination_and_unowned_backup_are_both_preserved() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let output = root.join("site");
    owned(&output, b"old");
    let transaction = writer(Arc::new(Race {
        case: "competing-and-unowned",
        root: root.clone(),
    }))
    .open(&output, boundary(&root))
    .unwrap();
    transaction
        .stage(&artifact(&output, b"new"), &Cancel(false))
        .unwrap();
    assert!(matches!(
        transaction.install(&Cancel(false)),
        Err(Error::Recovery { .. })
    ));
    assert_eq!(fs::read(output.join("concurrent")).unwrap(), b"keep");
    assert_eq!(
        fs::read(transaction.recovery_path().join("backup/unowned")).unwrap(),
        b"keep"
    );
    assert_eq!(
        fs::read(transaction.recovery_path().join("backup/index.html")).unwrap(),
        b"old"
    );
}
#[test]
fn independent_and_abandoned_reservations_do_not_steal_or_clean_other_paths() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let factory = writer(Arc::new(SystemRename));
    let abandoned = {
        let first = factory.open(&root.join("first"), boundary(&root)).unwrap();
        let second = factory.open(&root.join("second"), boundary(&root)).unwrap();
        second.abandon().unwrap();
        first.recovery_path().to_owned()
    };
    let namespace = root.join(".mokly-export-reservations");
    let unrelated = namespace.join("a".repeat(64));
    fs::create_dir(&unrelated).unwrap();
    fs::write(unrelated.join("keep"), "foreign").unwrap();
    assert!(matches!(
        factory.open(&root.join("first"), boundary(&root)),
        Err(Error::Reserved { .. })
    ));
    let third = factory.open(&root.join("third"), boundary(&root)).unwrap();
    third
        .stage(&artifact(third.output(), b"third"), &Cancel(false))
        .unwrap();
    third.install(&Cancel(false)).unwrap();
    assert!(abandoned.is_dir());
    assert_eq!(fs::read(unrelated.join("keep")).unwrap(), b"foreign");
    let old_hash =
        mokly_model::output::validation::digest(root.join("site").to_string_lossy().as_bytes());
    let legacy = root.join(format!(".mokly-export-{}.lock", &old_hash[..20]));
    fs::create_dir(&legacy).unwrap();
    fs::write(
        legacy.join(".mokly-export-transaction"),
        br#"{"schemaVersion":1,"output":"site"}"#,
    )
    .unwrap();
    let distinct = factory.open(&root.join("Site"), boundary(&root)).unwrap();
    distinct.abandon().unwrap();
    assert_eq!(
        fs::read(legacy.join(".mokly-export-transaction")).unwrap(),
        br#"{"schemaVersion":1,"output":"site"}"#
    );
}
#[test]
fn cancellation_without_previous_output_keeps_its_type_and_cleans_once() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let transaction = writer(Arc::new(SystemRename))
        .open(&root.join("site"), boundary(&root))
        .unwrap();
    transaction
        .stage(&artifact(transaction.output(), b"new"), &Cancel(false))
        .unwrap();
    assert!(matches!(
        transaction.install(&Cancel(true)),
        Err(Error::Cancelled)
    ));
    assert!(!transaction.output().exists());
    assert!(!transaction.recovery_path().exists());
    transaction.abandon().unwrap();
}
#[test]
fn an_unowned_namespace_and_file_destination_are_refused_before_writes() {
    let temporary = TempDir::new().unwrap();
    let root = dunce::canonicalize(temporary.path()).unwrap();
    let factory = writer(Arc::new(SystemRename));
    let output = root.join("site");
    fs::write(&output, "keep").unwrap();
    assert!(
        matches!(factory.open(&output, boundary(&root)), Err(Error::Destination { path }) if path == output)
    );
    assert_eq!(fs::read(&output).unwrap(), b"keep");
    assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
    fs::remove_file(&output).unwrap();
    fs::create_dir(root.join(".mokly-export-reservations")).unwrap();
    fs::write(root.join(".mokly-export-reservations/keep"), "foreign").unwrap();
    assert!(factory.open(&output, boundary(&root)).is_err());
    assert_eq!(
        fs::read(root.join(".mokly-export-reservations/keep")).unwrap(),
        b"foreign"
    );
}
