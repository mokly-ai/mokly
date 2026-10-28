//! Clean hashes use one stdin-paths command after confined disk reads.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, RunnerMock};
use crate::disk::DiskMock;
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{GitRepository, Repository};

#[test]
fn clean_hashes_batch_and_quote_unusual_paths() {
    let paths =
        ["a/package.json", "odd\n\"\\é/package.json"].map(|path| RepoPath::parse(path).unwrap());
    let object = ObjectId::parse(&"a".repeat(40)).unwrap();
    let repository = GitRepository {
        fetch_lock: std::sync::Mutex::new(()),
        unavailable: std::sync::Mutex::new(std::collections::BTreeMap::new()),
        timed_out: std::sync::Mutex::new(std::collections::BTreeSet::new()),
        directory: "/repo".into(),
        disk: Arc::new(Unimock::new(DiskMock::read.each_call(matching!(_, _, 100)).answers(&|_, _, _, _| Ok(Some(vec![]))).n_times(2))),
        runner: Arc::new(Unimock::new(RunnerMock::run.next_call(matching!((request) if request.args.last().unwrap() == "--stdin-paths" && request.stdin == b"\"./a/package.json\"\n\"./odd\\012\\\"\\\\\\303\\251/package.json\"\n")).returns(Ok(Output { stdout: format!("{object}\n{object}\n").into_bytes(), stderr: vec![] })))),
    };
    assert_eq!(
        repository.working_hashes(&paths, 100).unwrap(),
        [object.clone(), object]
    );
}

#[test]
fn empty_or_nonregular_hash_candidates_start_no_git_process() {
    let repository = GitRepository {
        fetch_lock: std::sync::Mutex::new(()),
        unavailable: std::sync::Mutex::new(std::collections::BTreeMap::new()),
        timed_out: std::sync::Mutex::new(std::collections::BTreeSet::new()),
        directory: "/repo".into(),
        runner: Arc::new(Unimock::new(())),
        disk: Arc::new(Unimock::new(
            DiskMock::read
                .next_call(matching!(_, _, _))
                .returns(Err(Error::NotRegular {
                    path: "package.json".into(),
                })),
        )),
    };
    assert!(repository.working_hashes(&[], 100).unwrap().is_empty());
    assert!(matches!(
        repository.working_hashes(&[RepoPath::parse("package.json").unwrap()], 100),
        Err(Error::NotRegular { .. })
    ));
}
