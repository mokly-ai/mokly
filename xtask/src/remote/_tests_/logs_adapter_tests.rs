//! Fresh filesystem resources, preserved existing files and bounded log tails.

use std::fs;
use std::io::ErrorKind;

use crate::remote::adapter_support::TestDirectory;
use crate::remote::contracts::Logs;
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, CommitSha};
use crate::remote::identity::{RunId, RunIdentity};
use crate::remote::logs::SystemLogs;

const PARENTS: [&str; 2] = [
    ".context/verification-logs/remote",
    ".context/verification-reports/remote",
];

#[test]
fn creates_fresh_log_and_report_directories_for_each_run() {
    let directory = TestDirectory::new();
    let logs = SystemLogs {
        workspace: directory.path().to_owned(),
    };
    for run in ["first", "second"] {
        logs.prepare(run).unwrap();
        for parent in PARENTS {
            let path = directory.path().join(parent).join(run);
            assert!(path.is_dir());
            assert_eq!(fs::read_dir(&path).unwrap().count(), 0);
            fs::write(path.join("preserved"), run).unwrap();
        }
    }
    for parent in PARENTS {
        assert_eq!(
            fs::read_to_string(directory.path().join(parent).join("first/preserved")).unwrap(),
            "first"
        );
    }
}

#[test]
fn rejects_an_existing_run_directory_in_either_parent() {
    for parent in PARENTS {
        let directory = TestDirectory::new();
        let logs = SystemLogs {
            workspace: directory.path().to_owned(),
        };
        let path = directory.path().join(parent).join("existing");
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("preserved"), "old run").unwrap();
        let error = logs.prepare("existing").unwrap_err();
        assert!(
            matches!(error, Error::Io { operation: Operation::Logs, source } if source.kind() == ErrorKind::AlreadyExists)
        );
        assert_eq!(
            fs::read_to_string(path.join("preserved")).unwrap(),
            "old run"
        );
    }
}

#[test]
fn rejects_an_existing_log_file_and_preserves_its_bytes() {
    let directory = TestDirectory::new();
    let logs = SystemLogs {
        workspace: directory.path().to_owned(),
    };
    let path = directory.path().join("command.log");
    let sink = logs.open(&path).unwrap();
    sink.write(b"stdout\n").unwrap();
    sink.write(b"stderr\n").unwrap();
    let error = match logs.open(&path) {
        Ok(_) => panic!("an existing log must not open again"),
        Err(error) => error,
    };
    assert!(
        matches!(error, Error::Io { operation: Operation::Logs, source } if source.kind() == ErrorKind::AlreadyExists)
    );
    assert_eq!(fs::read(&path).unwrap(), b"stdout\nstderr\n");
}

#[test]
fn tail_keeps_only_the_last_sixty_lines_and_all_short_logs() {
    let directory = TestDirectory::new();
    let logs = SystemLogs {
        workspace: directory.path().to_owned(),
    };
    for count in [0_usize, 3, 60, 83] {
        let path = directory.path().join(format!("{count}.log"));
        let lines: Vec<_> = (0..count).map(|line| format!("line-{line}")).collect();
        let text = if lines.is_empty() {
            String::new()
        } else {
            format!("{}\n", lines.join("\n"))
        };
        logs.open(&path).unwrap().write(text.as_bytes()).unwrap();
        let expected: Vec<_> = (count.saturating_sub(60)..count)
            .map(|line| format!("line-{line}"))
            .collect();
        assert_eq!(logs.tail(&path).unwrap(), expected.join("\n"));
    }
}

/// Identity evidence stays beside logs with exact bytes and cannot overwrite a file.
#[test]
fn identity_is_written_to_logs_and_keeps_the_report_directory_empty() {
    let directory = TestDirectory::new();
    let logs = SystemLogs {
        workspace: directory.path().to_owned(),
    };
    let identity = RunIdentity::new(
        RunId::new("20261006T120000Z", 42).unwrap(),
        CommitSha::read(&"b".repeat(40)).unwrap(),
        BaseCommit {
            sha: CommitSha::read(&"d".repeat(40)).unwrap(),
            ahead: 3,
        },
        &format!("sha256:{}", "a".repeat(64)),
    )
    .unwrap();
    logs.prepare(identity.run().as_str()).unwrap();
    logs.write_identity(&identity).unwrap();
    let path = directory
        .path()
        .join(PARENTS[0])
        .join(identity.run().as_str())
        .join("identity.json");
    assert_eq!(
        fs::read(&path).unwrap(),
        include_bytes!("fixtures/identity.json")
    );
    assert_eq!(
        fs::read_dir(
            directory
                .path()
                .join(PARENTS[1])
                .join(identity.run().as_str())
        )
        .unwrap()
        .count(),
        0
    );
    assert!(
        matches!(logs.write_identity(&identity), Err(Error::Io { source, .. }) if source.kind() == ErrorKind::AlreadyExists)
    );
    assert_eq!(
        fs::read(path).unwrap(),
        include_bytes!("fixtures/identity.json")
    );
}
