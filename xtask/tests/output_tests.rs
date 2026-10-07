//! Broken terminal streams must not turn output into a panic.

#[cfg(unix)]
use std::os::fd::OwnedFd;
#[cfg(unix)]
use std::os::unix::net::UnixStream;
#[cfg(unix)]
use std::process::{Command, Stdio};

#[cfg(unix)]
fn broken_output() -> Stdio {
    let writer = {
        let (writer, _reader) = UnixStream::pair().unwrap();
        writer
    };
    Stdio::from(OwnedFd::from(writer))
}

#[cfg(unix)]
#[test]
fn closed_stdout_preserves_the_executor_exit_status() {
    let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
        .args(["executor", "--executor", "local"])
        .stdout(broken_output())
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0));
    assert!(output.stdout.is_empty());
    assert!(output.stderr.is_empty());
}

#[cfg(unix)]
#[test]
fn closed_stderr_preserves_information_and_error_exit_statuses() {
    for (arguments, code, stdout) in [
        (
            vec!["executor", "--executor", "auto"],
            0,
            "local: BLACKSMITH_ORG_TOKEN is empty or unset\n",
        ),
        (
            vec!["check", "--executor", "remote", "--suite", "unit"],
            1,
            "",
        ),
    ] {
        let output = Command::new(env!("CARGO_BIN_EXE_xtask"))
            .args(arguments)
            .stderr(broken_output())
            .env_remove("BLACKSMITH_ORG_TOKEN")
            .env_remove("GITHUB_ACTIONS")
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(code));
        assert_eq!(String::from_utf8(output.stdout).unwrap(), stdout);
        assert!(output.stderr.is_empty());
    }
}
