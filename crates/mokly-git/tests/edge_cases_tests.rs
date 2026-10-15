//! Real regressions for unusual names, shallow history and streaming archives.

use std::fs;
#[cfg(unix)]
use std::os::unix::ffi::OsStringExt;
use std::process::Command;
#[cfg(unix)]
use std::sync::Arc;

use mokly_git::changes::Kind;
#[cfg(unix)]
use mokly_git::control::Token;
use mokly_git::disk::{ArchiveFile, Disk, SystemDisk};
use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
#[cfg(unix)]
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;

use support::Fixture;
#[cfg(unix)]
use support::runner;

mod support;

#[test]
fn an_unindexed_working_file_is_modified_instead_of_deleted() {
    let fixture = Fixture::new();
    fixture.write("kept.txt", b"base");
    let base = fixture.commit();
    fixture.git(&["rm", "--cached", "kept.txt"]);
    let changes = fixture.repository().changed_paths(&base).unwrap();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].kind, Kind::Modified);
}

#[cfg(unix)]
#[test]
fn unusual_and_nested_untracked_names_do_not_fail_queries_or_extraction() {
    let fixture = Fixture::new();
    fixture.write("docs/2024-01-01T10:00.md", b"date");
    fixture.write("specs/notes:draft.txt", b"notes");
    fixture.write("specs/back\\slash.txt", b"backslash");
    fs::write(
        fixture.root().join(std::ffi::OsString::from_vec(vec![253])),
        b"tracked non-utf-8",
    )
    .unwrap();
    let base = fixture.commit();
    let nested = fixture.root().join("scratch-clone");
    fs::create_dir(&nested).unwrap();
    Command::new("git")
        .arg("init")
        .arg(&nested)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    fs::write(nested.join("file"), b"nested").unwrap();
    fs::write(
        fixture.root().join(std::ffi::OsString::from_vec(vec![255])),
        b"non-utf-8",
    )
    .unwrap();
    let repository = fixture.repository();
    assert!(repository.changed_paths(&base).unwrap().is_empty());
    let entries = repository
        .list(
            &base,
            Some(&RepoPath::parse("specs").unwrap()),
            Limits::default(),
        )
        .unwrap();
    assert_eq!(
        entries.iter().filter(|entry| entry.mode.regular()).count(),
        2
    );
    let temporary = tempfile::tempdir().unwrap();
    let output = temporary.path().join("base");
    repository
        .extract(&base, &output, Limits::default())
        .unwrap();
    assert_eq!(
        fs::read(output.join("docs/2024-01-01T10:00.md")).unwrap(),
        b"date"
    );
    assert_eq!(
        fs::read(output.join("specs/back\\slash.txt")).unwrap(),
        b"backslash"
    );
}

#[test]
fn direct_archive_api_rejects_a_git_segment_and_removes_partial_data() {
    let temporary = tempfile::tempdir().unwrap();
    let destination = temporary.path().join("base");
    let disk: &dyn Disk = &SystemDisk;
    let files = [ArchiveFile {
        path: RepoPath::parse("safe/.git/config").unwrap(),
        bytes: b"unsafe".to_vec(),
        executable: false,
    }];
    assert!(matches!(
        disk.extract(&destination, &files),
        Err(Error::InvalidPath { .. })
    ));
    assert!(!destination.exists());
}

#[cfg(unix)]
#[test]
fn a_real_shallow_clone_cannot_invent_a_merge_base() {
    let fixture = Fixture::new();
    fixture.write("file", b"ancestor");
    fixture.commit();
    fixture.git(&["switch", "-c", "base"]);
    fixture.write("base", b"base");
    fixture.commit();
    fixture.git(&["switch", "-c", "head", "main"]);
    fixture.write("head", b"head");
    fixture.commit();
    let temporary = tempfile::tempdir().unwrap();
    let clone = temporary.path().join("shallow");
    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            "--branch",
            "head",
            &format!("file://{}", fixture.root().display()),
        ])
        .arg(&clone)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let output = Command::new("git")
        .args(["fetch", "--depth", "1", "origin", "base:base"])
        .current_dir(&clone)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(clone.join(".git/shallow").exists());
    let factory: &dyn Repositories = &GitRepositories {
        runner: runner(Arc::new(Token::default())),
        disk: Arc::new(SystemDisk),
    };
    assert!(matches!(
        factory.open(&clone).unwrap().merge_base("base"),
        Err(Error::NoMergeBase)
    ));
}

#[test]
fn extraction_streams_a_commit_larger_than_the_previous_memory_limit() {
    let fixture = Fixture::new();
    let bytes = vec![17; 34 * 1024 * 1024];
    fixture.write("assets/a.bin", &bytes);
    fixture.write("assets/b.bin", &bytes);
    let base = fixture.commit();
    let temporary = tempfile::tempdir().unwrap();
    let target = temporary.path().join("base");
    fixture
        .repository()
        .extract(
            &base,
            &target,
            Limits {
                bytes: 80 * 1024 * 1024,
                ..Limits::default()
            },
        )
        .unwrap();
    assert_eq!(
        fs::metadata(target.join("assets/a.bin")).unwrap().len(),
        bytes.len() as u64
    );
    assert_eq!(fs::read(target.join("assets/b.bin")).unwrap(), bytes);
}

#[test]
fn trace_probe() {
    if std::env::var_os("MOKLY_GIT_TRACE_PROBE").is_none() {
        return;
    }
    let fixture = Fixture::new();
    fixture.write("file", b"a");
    let base = fixture.commit();
    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("file").unwrap(), 1)
            .unwrap(),
        b"a"
    );
}

#[test]
fn exact_stdout_budgets_leave_room_for_git_trace_on_stderr() {
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "trace_probe", "--nocapture"])
        .env("MOKLY_GIT_TRACE_PROBE", "1")
        .env("GIT_TRACE", "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}
