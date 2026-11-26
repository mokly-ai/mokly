//! Public repository tree reads select ownership from cached promisor settings.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::command::{
    DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Output, ProcessMode, Request, RunnerMock,
};
use crate::disk::DiskMock;
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{GitRepositories, Repositories, Repository};
use crate::tree::{Entry, Limits, Mode};

fn commit() -> ObjectId {
    ObjectId::parse(&"a".repeat(40)).unwrap()
}

fn entry() -> Entry {
    Entry {
        path: RepoPath::parse("source.txt").unwrap(),
        object: ObjectId::parse(&"b".repeat(40)).unwrap(),
        mode: Mode::File,
        size: 3,
    }
}

fn capture_reads(
    settings: &'static [u8],
    requests: Arc<Mutex<Vec<Request>>>,
    missing: Arc<AtomicBool>,
) -> impl unimock::Clause {
    RunnerMock::run
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, request| {
            requests.lock().unwrap().push(request.clone());
            let stdout = match request.args[2].to_str().unwrap() {
                "rev-parse" if request.args[3] == "--show-toplevel" => b"/repo\n".to_vec(),
                "rev-parse" | "merge-base" => format!("{}\n", commit()).into_bytes(),
                "config" if settings.is_empty() => {
                    return Err(Error::CommandFailed {
                        status: Some(1),
                        stderr: Vec::new(),
                    });
                }
                "config" => settings.to_vec(),
                "ls-tree"
                    if request.args[3] == "-r"
                        || request.args.iter().any(|argument| argument == "source.txt") =>
                {
                    format!("100644 blob {} 3\tsource.txt\0", entry().object).into_bytes()
                }
                "ls-tree" => Vec::new(),
                "rev-list" if missing.load(Ordering::SeqCst) => {
                    format!("?{}\n", entry().object).into_bytes()
                }
                "rev-list" => format!("{}\n", entry().object).into_bytes(),
                _ => panic!("unexpected request: {request:?}"),
            };
            Ok(Output {
                stdout,
                stderr: Vec::new(),
            })
        }))
}

fn repositories(runner: Unimock) -> GitRepositories {
    GitRepositories {
        runner: Arc::new(runner),
        disk: Arc::new(Unimock::new(
            DiskMock::canonicalize
                .each_call(matching!((path) if *path == Path::new("/repo")))
                .answers(&|_, _| Ok(PathBuf::from("/repo"))),
        )),
    }
}

fn query(repository: &dyn Repository) {
    assert_eq!(repository.merge_base("main").unwrap(), commit());
    assert_eq!(
        repository.list(&commit(), None, Limits::default()).unwrap(),
        [entry()]
    );
    assert_eq!(
        repository
            .lookup(&commit(), &[entry().path], Limits::default())
            .unwrap(),
        [entry()]
    );
}

fn assert_requests(
    requests: &[Request],
    mode: ProcessMode,
    opens: usize,
    trees_per_open: usize,
    plain_per_open: usize,
) {
    let trees: Vec<_> = requests
        .iter()
        .filter(|request| request.args[2] == "ls-tree")
        .map(|request| request.process_mode)
        .collect();
    assert_eq!(trees, vec![mode; trees_per_open * opens]);
    let plain: Vec<_> = requests
        .iter()
        .filter(|request| request.args[2] != "ls-tree")
        .map(|request| request.process_mode)
        .collect();
    assert_eq!(plain, vec![ProcessMode::PlainGroup; plain_per_open * opens]);
    let configurations: Vec<_> = requests
        .iter()
        .filter(|request| request.args[2] == "config")
        .collect();
    assert_eq!(configurations.len(), opens);
    for configuration in configurations {
        assert_eq!(
            configuration.args[2..],
            [
                "config",
                "--null",
                "--get-regexp",
                r"^(remote\..*\.promisor|extensions\.partialclone)$"
            ]
            .map(OsString::from)
        );
    }
}

#[test]
fn tree_reads_keep_plain_groups_without_a_promisor_remote() {
    for settings in [
        b"".as_slice(),
        b"remote.origin.promisor\nfalse\0",
        b"remote.empty.promisor\n\0remote.zero.promisor\n0\0remote.scaled.promisor\n0k\0remote.hex.promisor\n0x0\0remote.octal.promisor\n00\0",
    ] {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let factory = repositories(Unimock::new(capture_reads(
            settings,
            Arc::clone(&requests),
            Arc::new(AtomicBool::new(false)),
        )));
        for _ in 0..2 {
            query(factory.open(Path::new("/repo")).unwrap().as_ref());
        }
        assert_requests(&requests.lock().unwrap(), ProcessMode::PlainGroup, 2, 2, 4);
    }
}

#[test]
fn tree_reads_own_helpers_for_a_promisor_remote() {
    for settings in [
        b"remote.origin.promisor\ntrue\0".as_slice(),
        b"remote.origin.promisor\n2\0",
        b"remote.origin.promisor\0",
    ] {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let factory = repositories(Unimock::new(capture_reads(
            settings,
            Arc::clone(&requests),
            Arc::new(AtomicBool::new(false)),
        )));
        let opened = factory.open(Path::new("/repo"));
        assert!(
            opened.is_ok(),
            "valid promisor settings {settings:?}: {opened:?}"
        );
        let repository = opened.unwrap();
        query(repository.as_ref());
        assert_requests(&requests.lock().unwrap(), ProcessMode::FullTree, 1, 6, 6);
    }
}

#[test]
fn partial_clone_remote_is_cached_for_tree_reads_and_explicit_fetches() {
    for settings in [
        b"extensions.partialclone\norigin\0".as_slice(),
        b"remote.origin.promisor\ntrue\0extensions.partialclone\norigin\0",
    ] {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let fetched = Arc::clone(&requests);
        let missing = Arc::new(AtomicBool::new(false));
        let factory = repositories(Unimock::new((
            capture_reads(settings, Arc::clone(&requests), Arc::clone(&missing)),
            RunnerMock::run_cancellable_with_environment_timeout
                .each_call(matching!(_, _, _, _))
                .answers_arc(Arc::new(move |_, request, _, environment, timeout| {
                    fetched.lock().unwrap().push(request.clone());
                    assert_eq!(environment, []);
                    assert_eq!(timeout, Duration::from_secs(120));
                    Ok(Output {
                        stdout: Vec::new(),
                        stderr: Vec::new(),
                    })
                })),
        )));
        let repository = factory.open(Path::new("/repo")).unwrap();
        query(repository.as_ref());
        assert_requests(&requests.lock().unwrap(), ProcessMode::FullTree, 1, 6, 6);
        missing.store(true, Ordering::SeqCst);
        assert_eq!(
            repository
                .lookup(&commit(), &[entry().path], Limits::default())
                .unwrap(),
            [entry()]
        );
        assert_eq!(
            repository.list(&commit(), None, Limits::default()).unwrap(),
            [entry()]
        );
        let requests = requests.lock().unwrap();
        assert_eq!(
            requests
                .iter()
                .filter(|request| request.args[2] == "config")
                .count(),
            1
        );
        assert_eq!(
            requests
                .iter()
                .filter(|request| request.args[2] == "ls-tree")
                .map(|request| request.process_mode)
                .collect::<Vec<_>>(),
            [ProcessMode::FullTree; 12]
        );
        let fetches: Vec<_> = requests
            .iter()
            .filter(|request| request.args.iter().any(|arg| arg == "fetch"))
            .collect();
        assert_eq!(fetches.len(), 2);
        for fetch in fetches {
            assert_eq!(fetch.process_mode, ProcessMode::FullTree);
            assert_eq!(
                fetch.args,
                [
                    "--no-optional-locks",
                    "-c",
                    "fetch.negotiationAlgorithm=noop",
                    "fetch",
                    "--no-tags",
                    "--no-write-fetch-head",
                    "--no-recurse-submodules",
                    "--no-auto-maintenance",
                    "--stdin",
                    "--",
                    "origin"
                ]
                .map(OsString::from)
            );
            assert_eq!(fetch.stdin, format!("{}\n", "b".repeat(40)).as_bytes());
            assert_eq!(fetch.output_limit, DEFAULT_OUTPUT_LIMIT);
            assert_eq!(fetch.stderr_limit, DEFAULT_STDERR_LIMIT);
        }
    }
}
