//! A settings read runs the object check only when its listing does not size every blob.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, RunnerMock};
use crate::error::Error;
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::source_key::CheckoutIdentity;

/// The commands of one settings read. `checks` counts the object check commands: the
/// attribute lookup (`ls-tree -l`) and `rev-list`.
fn repository(listing: String, missing: String, checks: Arc<AtomicUsize>) -> GitRepository {
    let (lookups, revisions) = (checks.clone(), checks);
    let runner = Unimock::new((
        RunnerMock::run
            .each_call(matching!((request) if request.args[2] == "config"))
            .answers(&|_, _| Ok(output(b"user.name\nFixture\0"))),
        RunnerMock::run
            .each_call(
                matching!((request) if request.args[2] == "ls-tree" && request.args[3] == "-r"),
            )
            .answers_arc(Arc::new(move |_, _| Ok(output(listing.as_bytes())))),
        RunnerMock::run
            .each_call(
                matching!((request) if request.args[2] == "ls-tree" && request.args[3] == "-l"),
            )
            .answers_arc(Arc::new(move |_, _| {
                lookups.fetch_add(1, Ordering::Relaxed);
                Ok(output(b""))
            })),
        RunnerMock::run
            .each_call(matching!((request) if request.args[2] == "rev-list"))
            .answers_arc(Arc::new(move |_, _| {
                revisions.fetch_add(1, Ordering::Relaxed);
                Ok(output(missing.as_bytes()))
            })),
        RunnerMock::run
            .each_call(matching!((request) if request.args[3] == "check-attr"))
            .answers(&|_, _| Ok(output(b"notes.txt\0text\0set\0"))),
    ));
    GitRepository {
        fetch_lock: Mutex::new(()),
        promisor_remotes: Vec::new(),
        unavailable: Mutex::new(BTreeMap::new()),
        timed_out: Mutex::new(BTreeSet::new()),
        directory: "/repo".into(),
        disk: Arc::new(Unimock::new(())),
        runner: Arc::new(runner),
    }
}

fn output(bytes: &[u8]) -> Output {
    Output {
        stdout: bytes.to_vec(),
        stderr: Vec::new(),
    }
}

fn notes(size: &str) -> String {
    format!(
        "040000 tree {}       -\tdocs\0120000 blob {} 9\tlink\0100644 blob {} {size}\tnotes.txt\0",
        "c".repeat(40),
        "d".repeat(40),
        "b".repeat(40)
    )
}

#[test]
fn a_listing_that_sizes_every_blob_runs_no_object_check() {
    let checks = Arc::new(AtomicUsize::new(0));
    let repository = repository(notes("5"), String::new(), checks.clone());
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let identity = repository.checkout_identity(&commit).unwrap();
    assert_eq!(
        identity,
        CheckoutIdentity {
            digest: "be4550f445d2b4c0c208f0c71b86d262d49bbda492ae5b7a41e82054ce155d6d".into(),
            filtered: false,
        }
    );
    assert_eq!(repository.source_key(&commit).unwrap(), identity.digest);
    assert_eq!(checks.load(Ordering::Relaxed), 0);
}

#[test]
fn a_missing_blob_runs_the_object_check_and_fails_as_before() {
    let checks = Arc::new(AtomicUsize::new(0));
    let missing = format!("?{}\n", "b".repeat(40));
    let repository = repository(notes("BAD"), missing, checks.clone());
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let result = repository.checkout_identity(&commit);
    assert!(
        matches!(&result, Err(Error::MissingObject { object }) if *object == "b".repeat(40)),
        "{result:?}"
    );
    assert_eq!(checks.load(Ordering::Relaxed), 2);
}
