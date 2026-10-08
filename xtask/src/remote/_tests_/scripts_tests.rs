//! Script and Git command boundaries without real execution.

use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::process::ProcessExecuteMock;
use crate::remote::runner::DefaultRemoteRunner;
use crate::remote::scripts::SystemScripts;

#[test]
fn git_and_script_contracts_use_the_exact_arguments_and_runtime_profile() {
    let process = Arc::new(Unimock::new(
        ProcessExecuteMock
            .each_call(matching!(_))
            .answers(&|_, request| {
                let output = if request.program == "git" {
                    if request.args == ["rev-parse", "HEAD"] {
                        "b".repeat(40)
                    } else {
                        assert_eq!(
                            request.args,
                            [
                                "for-each-ref",
                                "--contains",
                                "HEAD",
                                "--format=%(refname)",
                                "refs/remotes/origin/"
                            ]
                        );
                        "refs/remotes/origin/main\n".into()
                    }
                } else if request.args[0] == "scripts/verification/source-tree.mjs" {
                    format!("sha256:{}\n", "a".repeat(64))
                } else {
                    assert_eq!(
                        request.args,
                        [
                            "scripts/verification/aggregate.mjs",
                            "--reports",
                            "/reports",
                            "--commit",
                            &"b".repeat(40),
                            "--runtimes",
                            "node-22.14.0"
                        ]
                    );
                    String::new()
                };
                Ok(Output {
                    stdout: output,
                    stderr: String::new(),
                    code: Some(0),
                })
            }),
    ));
    let scripts = SystemScripts {
        process,
        workspace: PathBuf::from("/workspace"),
    };
    assert_eq!(scripts.head().unwrap().as_str(), "b".repeat(40));
    assert!(scripts.published().unwrap());
    assert_eq!(
        scripts.read(&PathBuf::from("/workspace")).unwrap(),
        format!("sha256:{}", "a".repeat(64))
    );
    scripts
        .validate(&PathBuf::from("/reports"), &"b".repeat(40))
        .unwrap();
}

#[test]
fn failed_script_streams_follow_the_warning_line() {
    for fingerprint in [true, false] {
        let process = Arc::new(Unimock::new(
            ProcessExecuteMock.next_call(matching!(_)).answers(&|_, _| {
                Ok(Output {
                    stdout: "failed stdout\n".into(),
                    stderr: "failed stderr\n".into(),
                    code: Some(1),
                })
            }),
        ));
        let scripts = SystemScripts {
            process,
            workspace: PathBuf::from("/workspace"),
        };
        let error = if fingerprint {
            scripts.read(&PathBuf::from("/workspace")).unwrap_err()
        } else {
            scripts
                .validate(&PathBuf::from("/reports"), &"b".repeat(40))
                .unwrap_err()
        };
        let messages = Arc::new(std::sync::Mutex::new(Vec::new()));
        let copy = messages.clone();
        let reporter = Arc::new(Unimock::new(
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, line| {
                    copy.lock().unwrap().push(line.to_owned());
                })),
        ));
        let unused = Arc::new(Unimock::new(()));
        let runner = DefaultRemoteRunner {
            dependencies: Dependencies {
                environment: unused.clone(),
                programs: unused.clone(),
                clock: unused.clone(),
                snapshot: Arc::new(Unimock::new(())),
                git: unused.clone(),
                blacksmith: unused.clone(),
                github: unused.clone(),
                fingerprint: unused.clone(),
                aggregate: unused.clone(),
                logs: unused.clone(),
                interrupt: unused,
                reporter,
                workspace: PathBuf::from("/workspace"),
            },
        };
        runner.report_failure("script", &error);
        let messages = messages.lock().unwrap();
        assert!(messages[0].starts_with("warning:"));
        assert_eq!(messages[1], "information: script stdout: failed stdout");
        assert_eq!(messages[2], "information: script stderr: failed stderr");
    }
}
