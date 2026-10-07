//! Exact Blacksmith commands and private stdin behavior.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::clients::{SystemBlacksmith, SystemGithub};
use crate::remote::contracts::{Blacksmith, Github, GithubRunState, Output};
use crate::remote::error::{Error, Operation};
use crate::remote::process::ProcessExecuteMock;

#[test]
fn login_uses_stdin_and_never_places_the_key_in_arguments_or_debug_output() {
    let process = Arc::new(Unimock::new(ProcessExecuteMock.next_call(matching!((request) if request.args == ["auth", "login", "--api-token", "-"] && request.input.as_deref() == Some("test-key") && request.blacksmith)).answers(&|_, request| {
        assert!(!format!("{request:?}").contains("test-key"));
        Ok(Output { code: Some(0), ..Output::default() })
    })));
    SystemBlacksmith {
        process,
        workspace: PathBuf::from("/workspace"),
    }
    .login("test-key")
    .unwrap();
}

#[test]
fn warmup_probe_download_status_and_stop_use_the_contract_arguments() {
    let process = Arc::new(Unimock::new(
        ProcessExecuteMock
            .each_call(matching!(_))
            .answers(&|_, request| {
                assert!(request.blacksmith);
                assert_eq!(request.cwd, PathBuf::from("/workspace"));
                match request.args[1].as_str() {
                    "warmup" => {
                        assert_eq!(
                            request.args,
                            [
                                "testbox",
                                "warmup",
                                "blacksmith-testbox.yml",
                                "--ref",
                                "feature",
                                "--idle-timeout",
                                "30"
                            ]
                        );
                        assert!(!request.cancellable);
                    }
                    "run" => {
                        assert_eq!(
                            &request.args[..6],
                            ["testbox", "run", "--id", "tbx_a", "--wait-timeout", "10m"]
                        );
                        assert!(request.cancellable);
                    }
                    "download" => assert_eq!(
                        request.args,
                        [
                            "testbox",
                            "download",
                            "--id",
                            "tbx_a",
                            "remote.json",
                            "/reports/local.json"
                        ]
                    ),
                    "status" | "stop" => {
                        assert_eq!(
                            &request.args[..3],
                            ["testbox", request.args[1].as_str(), "--id"]
                        );
                        assert!(!request.cancellable);
                    }
                    other => panic!("unexpected {other}"),
                }
                Ok(Output {
                    code: Some(0),
                    ..Output::default()
                })
            }),
    ));
    let client = SystemBlacksmith {
        process,
        workspace: PathBuf::from("/workspace"),
    };
    client.warmup("feature").unwrap();
    client.run("tbx_a", "probe", None).unwrap();
    client
        .download(
            "tbx_a",
            "remote.json",
            &PathBuf::from("/reports/local.json"),
        )
        .unwrap();
    client.status("tbx_a").unwrap();
    client.stop("tbx_a").unwrap();
}

#[test]
fn github_cleanup_cannot_be_cancelled_by_the_same_interrupt() {
    let process = Arc::new(Unimock::new(ProcessExecuteMock.next_call(matching!((request) if request.program == "gh" && request.args == ["run", "cancel", "123"] && !request.cancellable)).answers(&|_, _| Ok(Output { code: Some(0), ..Output::default() }))));
    SystemGithub {
        process,
        workspace: PathBuf::from("/workspace"),
    }
    .cancel(123)
    .unwrap();
}

#[test]
fn github_state_uses_exact_arguments_and_a_typed_status() {
    for (text, state) in [
        ("completed\n", GithubRunState::Completed),
        (" \tcompleted\r\n", GithubRunState::Completed),
        ("in_progress\n", GithubRunState::Other),
        ("new_status", GithubRunState::Other),
        ("completed-extra", GithubRunState::Other),
        ("null", GithubRunState::Other),
    ] {
        let text = text.to_owned();
        let process = Arc::new(Unimock::new(
            ProcessExecuteMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    assert_eq!(request.program, "gh");
                    assert_eq!(
                        request.args,
                        ["run", "view", "123", "--json", "status", "--jq", ".status"]
                    );
                    assert!(!request.cancellable);
                    assert!(!request.blacksmith);
                    assert!(request.input.is_none());
                    assert!(request.log.is_none());
                    assert_eq!(request.cwd.as_path(), Path::new("/workspace"));
                    Ok(Output {
                        stdout: text.clone(),
                        code: Some(0),
                        ..Output::default()
                    })
                })),
        ));
        assert_eq!(
            SystemGithub {
                process,
                workspace: PathBuf::from("/workspace")
            }
            .state(123)
            .unwrap(),
            state
        );
    }
}

#[test]
fn github_state_read_preserves_command_failures_and_rejects_empty_output() {
    for (code, text) in [(1, "completed\n"), (0, ""), (0, " \t\n")] {
        let text = text.to_owned();
        let process = Arc::new(Unimock::new(
            ProcessExecuteMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    Ok(Output {
                        stdout: text.clone(),
                        code: Some(code),
                        ..Output::default()
                    })
                })),
        ));
        let error = SystemGithub {
            process,
            workspace: PathBuf::from("/workspace"),
        }
        .state(123)
        .unwrap_err();
        if code != 0 {
            assert!(matches!(
                error,
                Error::Command {
                    operation: Operation::Github,
                    code: Some(1)
                }
            ));
        } else {
            assert!(matches!(error, Error::EmptyGithubState));
            assert_eq!(
                error.to_string(),
                "[xtask/remote] GitHub run state is empty"
            );
        }
    }
}
