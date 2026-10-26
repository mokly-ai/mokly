//! Git commands for test repositories, with failures that show Git's message.

use std::path::Path;
use std::process::{Command, Output};

/// Run Git in `directory` and return its trimmed standard output.
///
/// Panics with Git's standard error when the command fails.
pub fn git(directory: &Path, args: &[&str]) -> String {
    let output = run(directory, args);
    assert!(
        output.status.success(),
        "git {}: {}",
        args.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .expect("Git prints UTF-8 here")
        .trim()
        .to_owned()
}

/// Run Git in `directory` and return its complete result, also on failure.
pub fn run(directory: &Path, args: &[&str]) -> Output {
    Command::new("git")
        .current_dir(directory)
        .args(args)
        .output()
        .expect("Git starts")
}

/// Create a repository with a test identity and the given object format.
pub fn init(directory: &Path, object_format: &str) {
    git(
        directory,
        &["init", "-q", &format!("--object-format={object_format}")],
    );
    git(directory, &["config", "user.name", "Mokly Test"]);
    git(directory, &["config", "user.email", "test@example.com"]);
}

/// Stage every change and commit it with `message`.
pub fn commit_all(directory: &Path, message: &str) {
    git(directory, &["add", "-A"]);
    git(directory, &["commit", "-qm", message]);
}
