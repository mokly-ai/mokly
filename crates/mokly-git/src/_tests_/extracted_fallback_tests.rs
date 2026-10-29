//! Extraction file I/O errors fall back to the pinned Git bytes.

use std::ffi::OsString;
use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::command::{Output, Request, RunnerMock};
use crate::disk::DiskMock;
use crate::error::{Error, InternalError};
use crate::extracted::ExtractedFiles;
use crate::fingerprint::Fingerprint;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits, Mode};

fn entry(name: &str, object: char) -> Entry {
    Entry {
        path: RepoPath::parse(name).unwrap(),
        object: ObjectId::parse(&object.to_string().repeat(40)).unwrap(),
        mode: Mode::File,
        size: 2,
    }
}

fn commit() -> ObjectId {
    ObjectId::parse(&"c".repeat(40)).unwrap()
}

fn fingerprint() -> Fingerprint {
    Fingerprint::of(&std::fs::metadata(".").unwrap())
}

fn io_error() -> Error {
    Error::Internal(InternalError::Io {
        source: std::io::Error::from_raw_os_error(13),
    })
}

fn repository(runner: Unimock, disk: Unimock) -> GitRepository {
    GitRepository {
        fetch_lock: std::sync::Mutex::new(()),
        unavailable: std::sync::Mutex::new(std::collections::BTreeMap::new()),
        timed_out: std::sync::Mutex::new(std::collections::BTreeSet::new()),
        directory: "/repo".into(),
        runner: Arc::new(runner),
        disk: Arc::new(disk),
    }
}

fn preflight(entry: &Entry) -> impl unimock::Clause {
    (
        RunnerMock::run
            .next_call(matching!((request) if request.args.iter().any(|arg| arg == "ls-tree")))
            .returns(Ok(Output {
                stdout: Vec::new(),
                stderr: Vec::new(),
            })),
        RunnerMock::run
            .next_call(matching!((request) if request.args.iter().any(|arg| arg == "rev-list")))
            .returns(Ok(Output {
                stdout: format!("{}\n", entry.object).into_bytes(),
                stderr: Vec::new(),
            })),
    )
}

fn single_file(request: &Request, name: &str, object: char) -> bool {
    request.args[2..]
        == [
            "cat-file".into(),
            "--filters".into(),
            OsString::from(format!("--path={name}")),
            OsString::from(object.to_string().repeat(40)),
        ]
}

#[test]
fn an_extraction_fingerprint_io_error_leaves_only_other_files_fingerprinted() {
    let first = entry("first.txt", 'a');
    let second = entry("second.txt", 'b');
    let expected = fingerprint();
    let repository = repository(
        Unimock::new(()),
        Unimock::new((
            DiskMock::fingerprint
                .next_call(matching!((_, path) if path.as_str() == "first.txt"))
                .returns(Err(io_error())),
            DiskMock::fingerprint
                .next_call(matching!((_, path) if path.as_str() == "second.txt"))
                .returns(Ok(Some(expected))),
        )),
    );

    let extracted = repository
        .extracted_fingerprints(Path::new("/extraction"), &[first, second])
        .unwrap();
    assert_eq!(extracted.len(), 1);
}

#[test]
fn an_extraction_read_io_error_reads_that_file_through_git() {
    let first = entry("first.txt", 'a');
    let second = entry("second.txt", 'b');
    let expected = fingerprint();
    let repository = repository(
        Unimock::new((
            preflight(&first),
            RunnerMock::stream_cancellable_with_environment_timeout
                .next_call(
                    matching!((request, _, _, _, _, _) if single_file(request, "first.txt", 'a')),
                )
                .answers(&|_, _, _, _, _, output, _| {
                    std::io::Write::write_all(output, b"git")
                        .map_err(|source| Error::Internal(InternalError::Io { source }))
                }),
        )),
        Unimock::new((
            DiskMock::read_pinned
                .next_call(matching!((_, path, _, _) if path.as_str() == "first.txt"))
                .returns(Err(io_error())),
            DiskMock::read_pinned
                .next_call(matching!((_, path, _, _) if path.as_str() == "second.txt"))
                .returns(Ok(Some(b"disk".to_vec()))),
        )),
    );
    let extracted = ExtractedFiles {
        root: "/extraction".into(),
        fingerprints: [
            (first.path.clone(), expected),
            (second.path.clone(), expected),
        ]
        .into_iter()
        .collect(),
    };

    assert_eq!(
        repository
            .extracted_read(&commit(), &[first, second], Limits::default(), &extracted,)
            .unwrap(),
        [b"git".to_vec(), b"disk".to_vec()]
    );
}

#[test]
fn an_extraction_digest_io_error_hashes_that_file_through_git() {
    let entry = entry("first.txt", 'a');
    let expected = fingerprint();
    let repository = repository(
        Unimock::new((
            preflight(&entry),
            RunnerMock::run
                .next_call(matching!((request) if request.args.iter().any(|arg| arg == "config")))
                .returns(Ok(Output {
                    stdout: b"true\n".to_vec(),
                    stderr: Vec::new(),
                })),
            RunnerMock::digest_cancellable_with_environment_timeout
                .next_call(matching!((request, _, _, _) if single_file(request, "first.txt", 'a')))
                .returns(Ok("git-digest".into())),
        )),
        Unimock::new(
            DiskMock::digest_pinned
                .next_call(matching!((_, path, _) if path.as_str() == "first.txt"))
                .returns(Err(io_error())),
        ),
    );
    let extracted = ExtractedFiles {
        root: "/extraction".into(),
        fingerprints: [(entry.path.clone(), expected)].into_iter().collect(),
    };

    assert_eq!(
        repository
            .extracted_digest(&commit(), &entry, &extracted)
            .unwrap(),
        "git-digest"
    );
}
