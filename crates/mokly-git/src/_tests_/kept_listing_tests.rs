//! A kept base listing skips only the object check of an equal listing. Each identity reads
//! the listing, the configuration, and the attributes again.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, RunnerMock};
use crate::error::Error;
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::source_key::{CheckoutIdentity, MemoryKeptListing};

const FIXTURE: &str = "be4550f445d2b4c0c208f0c71b86d262d49bbda492ae5b7a41e82054ce155d6d";

/// The values that the runner gives now, and the count of object checks, which run one
/// `rev-list` each. `missing` is the `rev-list` output that names missing objects.
struct Answers {
    config: Mutex<Vec<u8>>,
    listing: Mutex<Vec<u8>>,
    notes: Mutex<Vec<u8>>,
    missing: Mutex<Vec<u8>>,
    checks: AtomicUsize,
}

impl Answers {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            config: Mutex::new(b"user.name\nFixture\0".to_vec()),
            listing: Mutex::new(
                format!("100644 blob {} 5\tnotes.txt\0", "b".repeat(40)).into_bytes(),
            ),
            notes: Mutex::new(b"text\0set\0".to_vec()),
            missing: Mutex::new(Vec::new()),
            checks: AtomicUsize::new(0),
        })
    }
}

fn output(bytes: &[u8]) -> Output {
    Output {
        stdout: bytes.to_vec(),
        stderr: Vec::new(),
    }
}

/// The kept identity read, which a Git repository always supplies.
fn identity(repository: &GitRepository, kept: &MemoryKeptListing) -> CheckoutIdentity {
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    repository
        .checkout_identity_kept(&commit, kept)
        .unwrap()
        .unwrap()
}

fn repository(answers: &Arc<Answers>) -> GitRepository {
    let (config, listing, check, attributes) = (
        answers.clone(),
        answers.clone(),
        answers.clone(),
        answers.clone(),
    );
    let runner = Unimock::new((
        RunnerMock::run
            .each_call(matching!((request) if request.args[2] == "config"))
            .answers_arc(Arc::new(move |_, _| {
                Ok(output(&config.config.lock().unwrap()))
            })),
        RunnerMock::run
            .each_call(
                matching!((request) if request.args[2] == "ls-tree" && request.args[3] == "-r"),
            )
            .answers_arc(Arc::new(move |_, _| {
                Ok(output(&listing.listing.lock().unwrap()))
            })),
        RunnerMock::run
            .each_call(
                matching!((request) if request.args[2] == "ls-tree" && request.args[3] == "-l"),
            )
            .answers(&|_, _| Ok(output(b""))),
        RunnerMock::run
            .each_call(matching!((request) if request.args[2] == "rev-list"))
            .answers_arc(Arc::new(move |_, _| {
                check.checks.fetch_add(1, Ordering::Relaxed);
                Ok(output(&check.missing.lock().unwrap()))
            })),
        RunnerMock::run
            .each_call(matching!((request) if request.args[3] == "check-attr"))
            .answers_arc(Arc::new(move |_, request| {
                let mut found = Vec::new();
                for path in request.stdin.split_inclusive(|byte| *byte == 0) {
                    found.extend_from_slice(path);
                    if path == b"notes.txt\0" {
                        found.extend_from_slice(&attributes.notes.lock().unwrap());
                    } else {
                        found.extend_from_slice(b"text\0unset\0");
                    }
                }
                Ok(output(&found))
            })),
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

#[test]
fn an_equal_listing_skips_only_the_object_check() {
    let answers = Answers::new();
    let repository = repository(&answers);
    let kept = MemoryKeptListing::default();
    let mut digests = Vec::new();
    for changed in [false, false, true, true] {
        if changed {
            *answers.listing.lock().unwrap() = format!(
                "100644 blob {} 7\textra.txt\0100644 blob {} 5\tnotes.txt\0",
                "c".repeat(40),
                "b".repeat(40)
            )
            .into_bytes();
        }
        let identity = identity(&repository, &kept);
        assert!(!identity.filtered);
        digests.push(identity.digest);
    }
    let changed = "8a30689b1cb747d3e879d8ac1c4387f2a6eafe39a669ff8e6a373a8e56a61489";
    assert_eq!(digests, [FIXTURE, FIXTURE, changed, changed]);
    assert_eq!(answers.checks.load(Ordering::Relaxed), 2);
}

#[test]
fn a_kept_listing_reads_the_configuration_and_the_attributes_again() {
    let answers = Answers::new();
    let repository = repository(&answers);
    let kept = MemoryKeptListing::default();
    let mut digests = vec![identity(&repository, &kept).digest];
    *answers.config.lock().unwrap() = b"user.name\nChanged\0".to_vec();
    digests.push(identity(&repository, &kept).digest);
    *answers.notes.lock().unwrap() = b"text\0unset\0".to_vec();
    digests.push(identity(&repository, &kept).digest);
    assert_eq!(
        digests,
        [
            FIXTURE,
            "d0dabe210a6f8d03b5ebc065cf46e230ace0abb3b54fb65952d59e1db6362dc8",
            "69bd7c70306dca1d5d41df53062b5484ec4979cd43a889f3df2b32931be9b799",
        ]
    );
    assert_eq!(answers.checks.load(Ordering::Relaxed), 1);
}

#[test]
fn a_failed_object_check_keeps_no_listing() {
    let answers = Answers::new();
    *answers.missing.lock().unwrap() = format!("?{}\n", "b".repeat(40)).into_bytes();
    let repository = repository(&answers);
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let kept = MemoryKeptListing::default();
    for read in 0..2 {
        let result = repository.checkout_identity_kept(&commit, &kept);
        assert!(
            matches!(&result, Err(Error::MissingObject { object }) if *object == "b".repeat(40)),
            "{read}: {result:?}"
        );
    }
    assert_eq!(answers.checks.load(Ordering::Relaxed), 2);
}
