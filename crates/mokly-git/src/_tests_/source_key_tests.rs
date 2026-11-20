//! Unsalted retention identity preserves the existing non-filtered source key bytes.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, ProcessMode, RunnerMock};
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::source_key::CheckoutIdentity;

#[test]
fn checkout_identity_preserves_the_existing_unfiltered_source_key() {
    let repository = GitRepository {
        fetch_lock: Mutex::new(()),
        promisor_remotes: Vec::new(),
        unavailable: Mutex::new(BTreeMap::new()),
        timed_out: Mutex::new(BTreeSet::new()),
        directory: "/repo".into(),
        disk: Arc::new(Unimock::new(())),
        runner: Arc::new(Unimock::new((
            RunnerMock::run
                .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup && request.args[2] == "config"))
                .answers(&|_, _| Ok(Output { stdout: b"user.name\nFixture\0".to_vec(), stderr: Vec::new() })),
            RunnerMock::run
                .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup && request.args[2] == "ls-tree" && request.args[3] == "-r"))
                .answers(&|_, _| Ok(Output { stdout: format!("100644 blob {} 5\tnotes.txt\0", "b".repeat(40)).into_bytes(), stderr: Vec::new() })),
            RunnerMock::run
                .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup && request.args[2] == "ls-tree" && request.args[3] == "-l"))
                .answers(&|_, _| Ok(Output { stdout: Vec::new(), stderr: Vec::new() })),
            RunnerMock::run
                .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup && request.args[2] == "rev-list"))
                .answers(&|_, _| Ok(Output { stdout: Vec::new(), stderr: Vec::new() })),
            RunnerMock::run
                .each_call(matching!((request) if request.process_mode == ProcessMode::PlainGroup && request.args[3] == "check-attr" && request.stdin == b"notes.txt\0"))
                .answers(&|_, _| Ok(Output { stdout: b"notes.txt\0text\0set\0".to_vec(), stderr: Vec::new() })),
        ))),
    };
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let expected = "be4550f445d2b4c0c208f0c71b86d262d49bbda492ae5b7a41e82054ce155d6d";
    assert_eq!(repository.source_key(&commit).unwrap(), expected);
    assert_eq!(
        repository.checkout_identity(&commit).unwrap(),
        CheckoutIdentity {
            digest: expected.into(),
            filtered: false,
        }
    );
}
