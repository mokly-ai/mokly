//! Git fixture processes ignore the developer's global and system configuration.

use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::thread;

/// Create an isolated Git command for custom arguments, environment, or status checks.
pub fn command() -> Command {
    let mut command = Command::new("git");
    command
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .env("GIT_CONFIG_NOSYSTEM", "1");
    command
}

/// Run an isolated Git command and return stdout after checking its exit status.
pub fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    run(command().current_dir(root).args(args))
}

/// Run a customized command and return stdout after checking its exit status.
pub fn run(command: &mut Command) -> Vec<u8> {
    let output = command.output().unwrap();
    checked_stdout(command, output)
}

/// Write input on a scoped thread while draining both output pipes, then check success.
pub fn git_input(root: &Path, args: &[&str], input: &[u8]) -> Vec<u8> {
    let mut command = command();
    let mut child = command
        .current_dir(root)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let (output, write_result) = thread::scope(|scope| {
        let writer = scope.spawn(move || stdin.write_all(input));
        let output = child.wait_with_output().unwrap();
        let write_result = writer.join().unwrap();
        (output, write_result)
    });
    let stdout = checked_stdout(&command, output);
    write_result.unwrap();
    stdout
}

fn checked_stdout(command: &Command, output: Output) -> Vec<u8> {
    let args: Vec<_> = command.get_args().collect();
    assert!(
        output.status.success(),
        "{args:?}: {}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
