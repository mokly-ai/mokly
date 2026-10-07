//! Shared SSH disconnection uses the exact control path and process request.

use std::fs;
use std::io::{self, ErrorKind};
use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::TestDirectory;
use crate::remote::clients::SystemBlacksmith;
use crate::remote::contracts::{Blacksmith, Disconnection, Output};
use crate::remote::error::{Error, Operation};
use crate::remote::process::ProcessExecuteMock;

const BOX_ID: &str = "tbx_01m4c70wyw6hgykwt2dn0dhn06";
const SOCKET_NAME: &str = "076e10189ff7c84e.sock";

fn socket(directory: &TestDirectory) -> PathBuf {
    let control = directory.path().join(".blacksmith/c");
    fs::create_dir_all(&control).unwrap();
    let socket = control.join(SOCKET_NAME);
    fs::write(&socket, []).unwrap();
    socket
}

#[test]
fn disconnect_uses_the_known_box_hash_and_exact_ssh_request() {
    let home = TestDirectory::new();
    let socket = socket(&home);
    let workspace = TestDirectory::new();
    let expected_workspace = workspace.path().to_owned();
    let process = Arc::new(Unimock::new(
        ProcessExecuteMock
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                assert_eq!(request.program, "ssh");
                assert_eq!(
                    request.args,
                    [
                        "-F",
                        "/dev/null",
                        "-S",
                        socket.to_str().unwrap(),
                        "-O",
                        "exit",
                        "localhost"
                    ]
                );
                assert_eq!(request.cwd, expected_workspace);
                assert!(matches!(request.operation, Operation::Ssh));
                assert!(request.input.is_none());
                assert!(request.log.is_none());
                assert!(!request.blacksmith);
                assert!(!request.cancellable);
                Ok(Output {
                    code: Some(0),
                    stdout: "Exit request sent.".into(),
                    ..Output::default()
                })
            })),
    ));
    let client = SystemBlacksmith {
        process,
        workspace: workspace.path().to_owned(),
        home: Some(home.path().to_owned()),
    };
    assert_eq!(client.disconnect(BOX_ID).unwrap(), Disconnection::Closed);
}

#[test]
fn disconnect_starts_no_process_for_a_missing_directory_or_socket() {
    let home = TestDirectory::new();
    let client = SystemBlacksmith {
        process: Arc::new(Unimock::new(())),
        workspace: home.path().to_owned(),
        home: Some(home.path().to_owned()),
    };
    assert_eq!(client.disconnect(BOX_ID).unwrap(), Disconnection::Absent);
    fs::create_dir_all(home.path().join(".blacksmith/c")).unwrap();
    assert_eq!(client.disconnect(BOX_ID).unwrap(), Disconnection::Absent);
}

#[test]
fn disconnect_returns_a_typed_error_for_unset_or_empty_home() {
    for home in [None, Some(PathBuf::new())] {
        let client = SystemBlacksmith {
            process: Arc::new(Unimock::new(())),
            workspace: PathBuf::from("/workspace"),
            home,
        };
        let error = client.disconnect(BOX_ID).unwrap_err();
        assert!(matches!(error, Error::MissingHome));
        assert_eq!(
            error.to_string(),
            "[xtask/remote] HOME is unset or empty; cannot close shared SSH connection"
        );
    }
}

#[test]
fn disconnect_preserves_ssh_exit_and_signal_errors_when_the_socket_remains() {
    for code in [Some(255), None] {
        let home = TestDirectory::new();
        socket(&home);
        let client = SystemBlacksmith {
            process: Arc::new(Unimock::new(
                ProcessExecuteMock
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        Ok(Output {
                            code,
                            stderr: "control request failed".into(),
                            ..Output::default()
                        })
                    })),
            )),
            workspace: home.path().to_owned(),
            home: Some(home.path().to_owned()),
        };
        assert!(
            matches!(client.disconnect(BOX_ID), Err(Error::Command { operation: Operation::Ssh, code: actual }) if actual == code)
        );
    }
}

#[test]
fn disconnect_treats_a_socket_lost_during_failed_exit_as_closed() {
    let home = TestDirectory::new();
    let socket = socket(&home);
    let client = SystemBlacksmith {
        process: Arc::new(Unimock::new(
            ProcessExecuteMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    fs::remove_file(&socket).unwrap();
                    Ok(Output {
                        code: Some(255),
                        ..Output::default()
                    })
                })),
        )),
        workspace: home.path().to_owned(),
        home: Some(home.path().to_owned()),
    };
    assert_eq!(client.disconnect(BOX_ID).unwrap(), Disconnection::Closed);
}

#[test]
fn disconnect_preserves_a_typed_process_start_error() {
    let home = TestDirectory::new();
    socket(&home);
    let client = SystemBlacksmith {
        process: Arc::new(Unimock::new(
            ProcessExecuteMock.next_call(matching!(_)).answers(&|_, _| {
                Err(Error::Io {
                    operation: Operation::Ssh,
                    source: io::Error::new(ErrorKind::NotFound, "ssh missing"),
                })
            }),
        )),
        workspace: home.path().to_owned(),
        home: Some(home.path().to_owned()),
    };
    assert!(
        matches!(client.disconnect(BOX_ID), Err(Error::Io { operation: Operation::Ssh, source }) if source.kind() == ErrorKind::NotFound)
    );
}
