//! Five cleanup adapters retain one diagnostic line; other commands do not.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::TestDirectory;
use crate::remote::clients::blacksmith::SystemBlacksmith;
use crate::remote::clients::github::SystemGithub;
use crate::remote::contracts::{Blacksmith, Github, Output};
use crate::remote::error::{Error, Operation};
use crate::remote::process::ProcessExecuteMock;

fn client(stdout: &str, stderr: &str, code: Option<i32>) -> SystemBlacksmith {
    let output = Output {
        stdout: stdout.into(),
        stderr: stderr.into(),
        code,
    };
    SystemBlacksmith {
        process: Arc::new(Unimock::new(
            ProcessExecuteMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| Ok(output.clone()))),
        )),
        workspace: PathBuf::from("/workspace"),
        home: None,
    }
}

fn detail(error: &Error) -> Option<&str> {
    match error {
        Error::Command { detail, .. } => detail.as_deref(),
        _ => panic!("expected a typed command error"),
    }
}

#[test]
fn cleanup_stderr_uses_the_last_nonempty_trimmed_line() {
    let error = client("stdout fallback", "first\n \t last stderr \t\n\n", Some(7))
        .status("tbx_a")
        .unwrap_err();
    assert_eq!(detail(&error), Some("last stderr"));
    assert_eq!(
        error.to_string(),
        "[xtask/remote] Blacksmith command failed with exit 7: last stderr"
    );
}

#[test]
fn cleanup_uses_stdout_when_stderr_has_no_nonempty_line() {
    let error = client("first stdout\n last stdout \n\n", " \t\n", Some(8))
        .stop("tbx_a")
        .unwrap_err();
    assert_eq!(detail(&error), Some("last stdout"));
    assert_eq!(
        error.to_string(),
        "[xtask/remote] Blacksmith command failed with exit 8: last stdout"
    );
}

#[test]
fn empty_streams_add_no_separator_for_exit_or_signal() {
    for (code, wording) in [(Some(9), "exit 9"), (None, "a signal")] {
        let error = client("\n \t\n", "\r\n", code).stop("tbx_a").unwrap_err();
        assert_eq!(detail(&error), None);
        assert_eq!(
            error.to_string(),
            format!("[xtask/remote] Blacksmith command failed with {wording}")
        );
    }
}

#[test]
fn cleanup_cuts_250_multibyte_characters_to_200_and_keeps_signal_wording() {
    let text = "界".repeat(250);
    let error = client("", &text, None).stop("tbx_a").unwrap_err();
    assert_eq!(detail(&error).unwrap().chars().count(), 200);
    let detail = error
        .to_string()
        .strip_prefix("[xtask/remote] Blacksmith command failed with a signal: ")
        .unwrap()
        .to_owned();
    assert_eq!(detail.chars().count(), 200);
    assert_eq!(detail, "界".repeat(200));
}

#[test]
fn github_cancel_and_state_keep_details_without_input_or_logs() {
    for state in [false, true] {
        let process = Arc::new(Unimock::new(
            ProcessExecuteMock
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    assert_eq!(request.program, "gh");
                    assert_eq!(request.args[1], if state { "view" } else { "cancel" });
                    assert!(request.input.is_none());
                    assert!(request.log.is_none());
                    assert!(!request.blacksmith);
                    assert!(!request.cancellable);
                    Ok(Output {
                        code: Some(3),
                        stderr: " first\n cancelled by service \n".into(),
                        ..Output::default()
                    })
                })),
        ));
        let client = SystemGithub {
            process,
            workspace: PathBuf::from("/workspace"),
        };
        let error = if state {
            client.state(123).unwrap_err()
        } else {
            client.cancel(123).unwrap_err()
        };
        assert_eq!(
            error.to_string(),
            "[xtask/remote] Github command failed with exit 3: cancelled by service"
        );
    }
}

#[test]
fn ssh_close_retains_error_detail_without_input_or_logs() {
    let home = TestDirectory::new();
    let control = home.path().join(".blacksmith/c");
    fs::create_dir_all(&control).unwrap();
    fs::write(control.join("076e10189ff7c84e.sock"), []).unwrap();
    let mut client = client("", "SSH close failed\n", Some(255));
    client.home = Some(home.path().to_owned());
    let error = client
        .disconnect("tbx_01m4c70wyw6hgykwt2dn0dhn06")
        .unwrap_err();
    assert!(matches!(
        error,
        Error::Command {
            operation: Operation::Ssh,
            code: Some(255),
            ..
        }
    ));
    assert_eq!(
        error.to_string(),
        "[xtask/remote] Ssh command failed with exit 255: SSH close failed"
    );
}

#[test]
fn non_cleanup_command_errors_keep_their_existing_text() {
    let client = client("stdout detail", "stderr detail", Some(4));
    for error in [
        client.version().unwrap_err(),
        client.login("test-only-input").unwrap_err(),
        client.list().unwrap_err(),
        client
            .download("tbx_a", "remote.json", &PathBuf::from("local.json"))
            .unwrap_err(),
    ] {
        assert_eq!(
            error.to_string(),
            "[xtask/remote] Blacksmith command failed with exit 4"
        );
        assert_eq!(detail(&error), None);
    }
}
