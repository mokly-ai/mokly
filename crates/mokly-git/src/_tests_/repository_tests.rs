//! Git argument selection, binary data, safety and output validation.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::changes::{self, ChangedPath, Kind};
use crate::command::{Output, RunnerMock};
use crate::disk::DiskMock;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::{GitRepositories, GitRepository, Repositories, Repository};
use crate::tree::{self, Entry, Limits, Mode};

fn id() -> ObjectId {
    ObjectId::parse(&"a".repeat(40)).unwrap()
}
fn output(bytes: &[u8]) -> Result<Output> {
    Ok(Output {
        stdout: bytes.to_vec(),
        stderr: vec![],
    })
}
fn repository(mock: Unimock) -> GitRepository {
    GitRepository {
        directory: "/repo".into(),
        runner: Arc::new(mock),
        disk: Arc::new(Unimock::new(())),
    }
}

#[test]
fn merge_base_resolves_refs_without_option_injection() {
    let repo = repository(Unimock::new((
        RunnerMock::run.next_call(matching!((request) if request.args[2..] == ["rev-parse", "--verify", "--end-of-options", "--danger^{commit}"].map(OsString::from)))
            .returns(output(format!("{}\n", id()).as_bytes())),
        RunnerMock::run.next_call(matching!((request) if request.args[2..] == ["merge-base", id().as_str(), "HEAD"].map(OsString::from)))
            .returns(output(format!("{}\n", id()).as_bytes())),
    )));
    assert_eq!(repo.merge_base("--danger").unwrap(), id());
}

#[test]
fn missing_history_is_typed() {
    let repo = repository(Unimock::new((
        RunnerMock::run
            .next_call(matching!(_))
            .returns(output(format!("{}\n", id()).as_bytes())),
        RunnerMock::run
            .next_call(matching!(_))
            .returns(Err(Error::CommandFailed {
                status: Some(1),
                stderr: vec![],
            })),
    )));
    assert!(matches!(repo.merge_base("base"), Err(Error::NoMergeBase)));
}

#[test]
fn root_projection_rejects_nested_repositories_and_preserves_aliases() {
    let disk = Unimock::new((
        DiskMock::canonicalize
            .next_call(matching!((path) if *path == Path::new("/alias")))
            .returns(Ok(PathBuf::from("/repo/sub"))),
        DiskMock::canonicalize
            .next_call(matching!((path) if *path == Path::new("/repo")))
            .returns(Ok(PathBuf::from("/repo"))),
    ));
    let factory: &dyn Repositories = &GitRepositories {
        runner: Arc::new(Unimock::new(
            RunnerMock::run
                .next_call(matching!(_))
                .returns(output(b"/repo\n")),
        )),
        disk: Arc::new(disk),
    };
    assert!(
        matches!(factory.open(Path::new("/alias")), Err(Error::RootMismatch { configured, actual }) if configured == Path::new("/repo/sub") && actual == Path::new("/repo"))
    );
}

#[test]
fn blobs_use_object_ids_on_stdin_and_keep_binary_bytes() {
    let listing = format!("100644 blob {} 3\tspecs/a\nfile\0", id());
    let blob = [
        format!("{} blob 3\n", id()).as_bytes(),
        &[0, 255, 10],
        b"\n",
    ]
    .concat();
    let repo = repository(Unimock::new((
        RunnerMock::run.next_call(matching!((request) if request.args.last().unwrap() == "specs/a\nfile")).returns(output(listing.as_bytes())),
        RunnerMock::run.next_call(matching!((request) if request.stdin == format!("{}\n", id()).as_bytes() && request.args[2..] == ["cat-file", "--batch"].map(OsString::from))).returns(output(&blob)),
    )));
    assert_eq!(
        repo.read(&id(), &RepoPath::parse("specs/a\nfile").unwrap(), 3)
            .unwrap(),
        [0, 255, 10]
    );
}

#[test]
fn oversize_and_symlink_reads_never_start_cat_file() {
    for (mode, expected) in [("100644", false), ("120000", true)] {
        let listing = format!("{mode} blob {} 4\tfile\0", id());
        let repo = repository(Unimock::new(
            RunnerMock::run
                .next_call(matching!(_))
                .returns(output(listing.as_bytes())),
        ));
        let error = repo
            .read(&id(), &RepoPath::parse("file").unwrap(), 3)
            .unwrap_err();
        if expected {
            assert!(matches!(error, Error::NotRegular { .. }));
        } else {
            assert!(matches!(error, Error::ByteLimit { limit: 3 }));
        }
    }
}

#[test]
fn changes_preserve_renames_and_add_untracked_paths() {
    let repo = repository(Unimock::new((
        RunnerMock::run
            .next_call(
                matching!((request) if request.args.iter().any(|arg| arg == "--find-renames")),
            )
            .returns(output(b"R100\0old\0new\0M\0edit\0")),
        RunnerMock::run
            .next_call(
                matching!((request) if request.args.iter().any(|arg| arg == "--exclude-standard")),
            )
            .returns(output(b"untracked\0edit\0")),
    )));
    let changes = repo.changed_paths(&id()).unwrap();
    assert_eq!(changes.len(), 3);
    assert_eq!(
        changes[1].kind,
        Kind::Renamed {
            from: ChangedPath::parse("old").unwrap(),
            similarity: 100
        }
    );
    assert_eq!(changes[2].kind, Kind::Added);
}

#[test]
fn malformed_status_and_tree_records_are_rejected() {
    for bytes in [
        b"R100\0old\0".as_slice(),
        b"R101\0a\0b\0",
        b"M\0no-terminator",
        b"Q\0file\0",
    ] {
        assert!(changes::parse(bytes).is_err());
    }
    for bytes in [
        b"bad\0".as_slice(),
        b"100644 blob bad 0\tfile\0",
        b"100644 blob bad 0\tfile",
    ] {
        assert!(tree::parse(bytes, Limits::default()).is_err());
    }
    let entry = Entry {
        path: RepoPath::parse("file").unwrap(),
        object: id(),
        mode: Mode::File,
        size: 1,
    };
    for bytes in [
        b"no header".as_slice(),
        b"wrong header\na\n",
        format!("{} blob 1\na", id()).as_bytes(),
    ] {
        assert!(tree::blobs(bytes, std::slice::from_ref(&entry)).is_err());
    }
}

#[test]
fn path_identity_preserves_case_and_rejects_escapes() {
    for path in ["", "/root", "a//b", "a/../b", "a/./b", "a\0b"] {
        assert!(RepoPath::parse(path).is_err(), "{path:?}");
    }
    assert_ne!(RepoPath::parse("A").unwrap(), RepoPath::parse("a").unwrap());
    assert!(
        RepoPath::parse("a/b")
            .unwrap()
            .under(&RepoPath::parse("a").unwrap())
    );
    assert!(
        !RepoPath::parse("ab")
            .unwrap()
            .under(&RepoPath::parse("a").unwrap())
    );
    for value in ["main", "--flag", &"a".repeat(41), &"g".repeat(40)] {
        assert!(ObjectId::parse(value).is_err());
    }
    assert_eq!(
        ObjectId::parse(&"A".repeat(64)).unwrap().as_str(),
        "a".repeat(64)
    );
}

#[test]
fn tree_count_and_archive_total_are_bounded_before_io() {
    let listing = format!("100644 blob {} 3\ta\0100644 blob {} 3\tb\0", id(), id());
    assert!(matches!(
        tree::parse(
            listing.as_bytes(),
            Limits {
                files: 1,
                ..Limits::default()
            }
        ),
        Err(Error::FileCount { limit: 1 })
    ));
    let repo = repository(Unimock::new(
        RunnerMock::run
            .next_call(matching!(_))
            .returns(output(listing.as_bytes())),
    ));
    assert!(matches!(
        repo.extract(
            &id(),
            Path::new("/dest"),
            Limits {
                bytes: 5,
                ..Limits::default()
            }
        ),
        Err(Error::ByteLimit { limit: 5 })
    ));
}

#[test]
fn source_byte_reads_keep_their_per_file_limit() {
    let repo = repository(Unimock::new(()));
    let entry = Entry {
        path: RepoPath::parse("asset.bin").unwrap(),
        object: id(),
        mode: Mode::File,
        size: 3,
    };
    assert!(matches!(
        repo.read_many(
            &[entry],
            Limits {
                blob: 2,
                ..Limits::default()
            }
        ),
        Err(Error::ByteLimit { limit: 2 })
    ));
}

#[test]
fn renames_keep_the_utf8_side_when_the_other_side_is_not_utf8() {
    let added = changes::parse(b"R100\0old-\xff\0new.screen.html\0").unwrap();
    assert_eq!(added.len(), 1);
    assert_eq!(added[0].path.as_str(), "new.screen.html");
    assert_eq!(added[0].kind, Kind::Added);
    let deleted = changes::parse(b"R100\0old.screen.html\0new-\xff\0").unwrap();
    assert_eq!(deleted.len(), 1);
    assert_eq!(deleted[0].path.as_str(), "old.screen.html");
    assert_eq!(deleted[0].kind, Kind::Deleted);
}

#[test]
fn tree_files_and_metadata_nodes_have_independent_bounds() {
    let listing = format!(
        "040000 tree {} -\ta\0100644 blob {} 1\ta/b\0040000 tree {} -\tc\0100644 blob {} 1\tc/d\0",
        id(),
        id(),
        id(),
        id()
    );
    let limits = Limits {
        files: 2,
        nodes: 4,
        ..Limits::default()
    };
    assert_eq!(tree::parse(listing.as_bytes(), limits).unwrap().len(), 4);
    assert!(matches!(
        tree::parse(listing.as_bytes(), Limits { files: 1, ..limits }),
        Err(Error::FileCount { limit: 1 })
    ));
    assert!(matches!(
        tree::parse(listing.as_bytes(), Limits { nodes: 3, ..limits }),
        Err(Error::NodeCount { limit: 3 })
    ));
}
