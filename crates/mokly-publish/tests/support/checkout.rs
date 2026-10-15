//! Isolated real Git fixture construction and the host checkout adapter.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

use mokly_git::control;
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_publish::checkout::{Checkout, GitCheckout};
use mokly_publish::hints::SystemOutputHints;

pub fn git(directory: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(directory)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

pub fn init(directory: &Path, sha256: bool) {
    fs::create_dir_all(directory).unwrap();
    git(
        directory,
        &[
            "init",
            "-q",
            if sha256 {
                "--object-format=sha256"
            } else {
                "--object-format=sha1"
            },
        ],
    );
    git(directory, &["config", "user.name", "Mokly Test"]);
    git(directory, &["config", "user.email", "test@example.com"]);
    fs::write(directory.join("source.txt"), "source").unwrap();
    git(directory, &["add", "."]);
    git(directory, &["commit", "-qm", "test fixture"]);
}

pub fn checkout() -> Arc<dyn Checkout> {
    Arc::new(GitCheckout {
        hints: Arc::new(SystemOutputHints),
        runner: Arc::new(SystemRunner {
            clock: Arc::new(control::SystemClock::default()),
            cancellation: Arc::new(control::Token::default()),
            groups: Arc::new(SystemProcessGroups),
        }),
    })
}
