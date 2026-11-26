//! Public file listings bind fsmonitor suppression to their process ownership.

use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::changes::{Change, ChangedPath, Kind};
use crate::command::{
    DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Output, ProcessMode, Request, RunnerMock,
};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{GitRepository, Repository};

fn repository(
    requests: Arc<Mutex<Vec<Request>>>,
    listing: &'static [u8],
    promisor_remotes: Vec<String>,
) -> GitRepository {
    GitRepository {
        fetch_lock: Mutex::new(()),
        promisor_remotes,
        unavailable: Mutex::new(BTreeMap::new()),
        timed_out: Mutex::new(BTreeSet::new()),
        proven: Default::default(),
        directory: "/repo".into(),
        disk: Arc::new(Unimock::new(())),
        runner: Arc::new(Unimock::new(
            RunnerMock::run
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    requests.lock().unwrap().push(request.clone());
                    let stdout = if request.args.iter().any(|arg| arg == "diff") {
                        b"D\0again.screen.html\0R100\0old.screen.html\0renamed.screen.html\0"
                            .to_vec()
                    } else {
                        listing.to_vec()
                    };
                    Ok(Output {
                        stdout,
                        stderr: Vec::new(),
                    })
                })),
        )),
    }
}

fn expected(mode: ProcessMode, args: &[&str]) -> Request {
    Request {
        process_mode: mode,
        directory: "/repo".into(),
        args: ["--no-optional-locks", "--literal-pathspecs"]
            .iter()
            .chain(args)
            .map(OsString::from)
            .collect(),
        stdin: Vec::new(),
        output_limit: DEFAULT_OUTPUT_LIMIT,
        stderr_limit: DEFAULT_STDERR_LIMIT,
    }
}

fn base() -> ObjectId {
    ObjectId::parse(&"a".repeat(40)).unwrap()
}

#[test]
fn working_paths_disable_fsmonitor_and_use_plain_group() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let repository = repository(
        Arc::clone(&requests),
        b"z.screen.html\0a [literal].screen.html\0z.screen.html\0nested/\0bad-\xff\0",
        Vec::new(),
    );
    assert_eq!(
        repository.working_paths().unwrap(),
        ["a [literal].screen.html", "z.screen.html"].map(|path| RepoPath::parse(path).unwrap())
    );
    assert_eq!(
        *requests.lock().unwrap(),
        [expected(
            ProcessMode::PlainGroup,
            &[
                "-c",
                "core.fsmonitor=false",
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
        )]
    );
}

#[test]
fn changed_paths_disable_fsmonitor_only_for_plain_group_listing() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let repository = repository(
        Arc::clone(&requests),
        b"z.screen.html\0again.screen.html\0nested/\0bad-\xff\0",
        Vec::new(),
    );
    assert_eq!(
        repository.changed_paths(&base()).unwrap(),
        [
            Change {
                path: ChangedPath::parse("again.screen.html").unwrap(),
                kind: Kind::Modified,
            },
            Change {
                path: ChangedPath::parse("renamed.screen.html").unwrap(),
                kind: Kind::Renamed {
                    from: ChangedPath::parse("old.screen.html").unwrap(),
                    similarity: 100,
                },
            },
            Change {
                path: ChangedPath::parse("z.screen.html").unwrap(),
                kind: Kind::Added,
            },
        ]
    );
    assert_eq!(
        *requests.lock().unwrap(),
        [
            expected(
                ProcessMode::FullTree,
                &[
                    "diff",
                    "--name-status",
                    "-z",
                    "--find-renames",
                    "--no-ext-diff",
                    "--no-textconv",
                    base().as_str(),
                    "--",
                ],
            ),
            expected(
                ProcessMode::PlainGroup,
                &[
                    "-c",
                    "core.fsmonitor=false",
                    "ls-files",
                    "--others",
                    "--exclude-standard",
                    "-z",
                ],
            ),
        ]
    );
}

#[test]
fn promisor_file_listings_keep_full_tree_with_fsmonitor_disabled() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let repository = repository(
        Arc::clone(&requests),
        b"untracked.screen.html\0",
        vec!["origin".into()],
    );
    repository.working_paths().unwrap();
    repository.changed_paths(&base()).unwrap();
    let requests = requests.lock().unwrap();
    assert_eq!(
        [&requests[0], &requests[2]],
        [
            &expected(
                ProcessMode::FullTree,
                &[
                    "-c",
                    "core.fsmonitor=false",
                    "ls-files",
                    "-z",
                    "--cached",
                    "--others",
                    "--exclude-standard",
                ],
            ),
            &expected(
                ProcessMode::FullTree,
                &[
                    "-c",
                    "core.fsmonitor=false",
                    "ls-files",
                    "--others",
                    "--exclude-standard",
                    "-z",
                ],
            ),
        ]
    );
}
