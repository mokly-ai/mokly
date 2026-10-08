//! Exact shell-free base lookup requests and unexpected Git failure propagation.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{Git, Output};
use crate::remote::error::{Error, Operation};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};
use crate::remote::process::ProcessExecuteMock;
use crate::remote::scripts::SystemScripts;

/// Build an output value with a controlled real exit code.
fn output(stdout: &str, code: i32) -> Output {
    Output {
        stdout: stdout.into(),
        code: Some(code),
        ..Output::default()
    }
}

/// Exact captured arguments also prove no Git data can reach a shell command.
#[test]
fn main_filter_and_count_use_validated_sha_arguments_in_the_required_order() {
    let head = "b".repeat(40);
    let main = "a".repeat(40);
    let branch = "f".repeat(40);
    let expected = Arc::new(Mutex::new(VecDeque::from([
        (
            vec![
                "for-each-ref".into(),
                "--format=%(refname) %(symref)".into(),
                "refs/remotes/origin/".into(),
            ],
            output(
                "refs/remotes/origin/feature \nrefs/remotes/origin/main \nrefs/remotes/origin/HEAD refs/remotes/origin/main\n",
                0,
            ),
        ),
        (
            vec![
                "merge-base".into(),
                head.clone(),
                "refs/remotes/origin/feature".into(),
            ],
            output(&branch, 0),
        ),
        (
            vec![
                "merge-base".into(),
                head.clone(),
                "refs/remotes/origin/main".into(),
            ],
            output(&main, 0),
        ),
        (
            vec![
                "merge-base".into(),
                "--independent".into(),
                main.clone(),
                branch.clone(),
            ],
            output(&format!("{main}\n{branch}\n"), 0),
        ),
        (
            vec![
                "merge-base".into(),
                head.clone(),
                "refs/remotes/origin/main".into(),
            ],
            output(&main, 0),
        ),
        (
            vec![
                "merge-base".into(),
                "--is-ancestor".into(),
                main.clone(),
                main.clone(),
            ],
            output("", 0),
        ),
        (
            vec![
                "rev-list".into(),
                "--count".into(),
                format!("{main}..{head}"),
            ],
            output("4\n", 0),
        ),
        (
            vec![
                "merge-base".into(),
                "--is-ancestor".into(),
                main.clone(),
                branch,
            ],
            output("", 1),
        ),
    ])));
    let pending = expected.clone();
    let process = Arc::new(Unimock::new(
        ProcessExecuteMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                assert_eq!(request.program, "git");
                assert_eq!(request.cwd, PathBuf::from("/workspace"));
                assert!(request.cancellable);
                assert!(!request.blacksmith);
                assert!(request.git_index.is_none());
                assert!(request.input.is_none());
                let (args, output): (Vec<String>, Output) =
                    pending.lock().unwrap().pop_front().unwrap();
                assert_eq!(request.args, args);
                Ok(output)
            })),
    ));
    let scripts = SystemScripts {
        process,
        workspace: "/workspace".into(),
    };
    assert_eq!(
        scripts.base(&CommitSha::read(&head).unwrap()).unwrap(),
        BaseLookup::Found(BaseCommit {
            sha: CommitSha::read(&main).unwrap(),
            ahead: 4
        })
    );
    assert!(expected.lock().unwrap().is_empty());
}

/// Exit 1 means absent history; other exits and signals retain typed command failure.
#[test]
fn lookup_failures_are_not_treated_as_missing_history() {
    for code in [Some(128), None] {
        let scripts = SystemScripts {
            process: Arc::new(Unimock::new(
                ProcessExecuteMock
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        Ok(Output {
                            code,
                            stderr: "Git lookup failure".into(),
                            ..Output::default()
                        })
                    })),
            )),
            workspace: "/workspace".into(),
        };
        assert!(
            matches!(scripts.base(&CommitSha::read(&"b".repeat(40)).unwrap()),
            Err(Error::Captured { source, .. }) if matches!(*source, Error::Command { operation: Operation::Git, code: actual, .. } if actual == code))
        );
    }
}

/// Git HEAD output receives the same full lowercase identity validation as candidates.
#[test]
fn head_output_rejects_short_uppercase_and_multiple_sha_lines() {
    for value in [
        "abc".to_owned(),
        "A".repeat(40),
        format!("{}\n{}", "a".repeat(40), "b".repeat(40)),
    ] {
        let scripts = SystemScripts {
            process: Arc::new(Unimock::new(
                ProcessExecuteMock
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| Ok(output(&value, 0)))),
            )),
            workspace: "/workspace".into(),
        };
        assert!(matches!(scripts.head(), Err(Error::InvalidGitSha)));
    }
}
