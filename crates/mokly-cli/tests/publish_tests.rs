//! Publish runs its available checks and reports the static builder boundary.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

fn git(directory: &Path, args: &[&str]) {
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
}

fn checkout() -> tempfile::TempDir {
    let directory = tempfile::tempdir().unwrap();
    git(directory.path(), &["init", "-q"]);
    git(
        directory.path(),
        &["config", "user.email", "test@example.com"],
    );
    git(directory.path(), &["config", "user.name", "Mokly Test"]);
    fs::write(directory.path().join("mokly.config.json"), "{}").unwrap();
    git(directory.path(), &["add", "."]);
    git(directory.path(), &["commit", "-qm", "test fixture"]);
    directory
}

fn run(directory: &Path, args: &[&str], mode: &str) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(directory)
        .arg("publish")
        .args(args)
        .env("MOKLY_OUTPUT", mode)
        .env_remove("MOKLY_SIDECARS")
        .env_remove("MOKLY_ENDPOINT")
        .env_remove("MOKLY_TOKEN")
        .env_remove("GITHUB_ACTIONS")
        .output()
        .unwrap()
}

#[test]
fn clean_current_only_publish_prints_one_retained_directory_then_one_unavailable_line() {
    let directory = checkout();
    for mode in ["plain", "rich"] {
        let output = run(
            directory.path(),
            &[
                "--endpoint=https://example.com/plan?x=1=2",
                "--token=secret/a==",
                "--repository=example.com/team/project",
                "--no-changes",
            ],
            mode,
        );
        assert_eq!(output.status.code(), Some(1));
        assert_eq!(
            String::from_utf8(output.stderr).unwrap(),
            "[mokly/build-invalid] Static output is not available in this build.\n"
        );
        let line = String::from_utf8(output.stdout).unwrap();
        assert_eq!(line.lines().count(), 1);
        let path = line
            .trim_end()
            .strip_prefix("Mokly publish build: ")
            .unwrap();
        let path = Path::new(path);
        assert!(path.is_absolute());
        assert_eq!(path.file_name().unwrap(), "site");
        assert!(!path.exists());
        assert!(path.parent().unwrap().is_dir());
        assert!(!path.to_string_lossy().starts_with(r"\\?\"));
        assert!(!path.starts_with(directory.path()));
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 2);
        fs::remove_dir(path.parent().unwrap()).unwrap();
    }
}

#[test]
fn dirty_checkout_blocks_build_and_escape_paths_without_exposing_the_token() {
    let directory = checkout();
    fs::write(directory.path().join("untracked.txt"), "changed").unwrap();
    let output = run(
        directory.path(),
        &[
            "--endpoint=https://example.com/plan",
            "--token=secret/a==",
            "--repository=example.com/team/project",
            "--no-changes",
        ],
        "plain",
    );
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    let error = String::from_utf8(output.stderr).unwrap();
    assert_eq!(
        error,
        "[mokly/git-uncommitted] The checkout has uncommitted changes.\n  - untracked.txt\nCommit, stash or ignore these files, then publish again.\n"
    );
    assert!(!error.contains("secret"));
}

#[test]
fn endpoint_and_token_environment_fallbacks_are_checked_before_build() {
    let directory = checkout();
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(directory.path())
        .args([
            "publish",
            "--repository=example.com/team/project",
            "--no-changes",
        ])
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_ENDPOINT", "https://example.com/plan#fragment")
        .env("MOKLY_TOKEN", "secret")
        .env_remove("MOKLY_SIDECARS")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(
        String::from_utf8(output.stderr)
            .unwrap()
            .contains("without credentials or a fragment")
    );
    let empty = tempfile::tempdir().unwrap();
    let output = run(
        empty.path(),
        &[
            "--endpoint=https://example.com/plan",
            "--token=secret",
            "--repository=example.com/team/project",
            "--no-changes",
        ],
        "plain",
    );
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/git-failed] Publish requires a Git checkout with a committed HEAD.\n"
    );
    git(empty.path(), &["init", "-q"]);
    let unborn = run(
        empty.path(),
        &[
            "--endpoint=https://example.com/plan",
            "--token=secret",
            "--repository=example.com/team/project",
            "--no-changes",
        ],
        "plain",
    );
    assert!(unborn.stdout.is_empty());
    assert_eq!(
        String::from_utf8(unborn.stderr).unwrap(),
        "[mokly/git-failed] Publish requires a Git checkout with a committed HEAD.\n"
    );
}

#[test]
fn dirty_custom_build_output_gets_a_literal_ignore_rule() {
    let directory = checkout();
    let output = directory.path().join("site[1]");
    fs::create_dir(&output).unwrap();
    fs::write(
        output.join(".mokly-export-artifact"),
        r#"{"schemaVersion":3,"files":[]}"#,
    )
    .unwrap();
    fs::write(output.join("index.html"), "shell").unwrap();
    let result = run(
        directory.path(),
        &[
            "--endpoint=https://example.com/plan",
            "--token=secret",
            "--no-changes",
            "--repository=example.com/team/project",
        ],
        "plain",
    );
    assert_eq!(result.status.code(), Some(1));
    assert!(result.stdout.is_empty());
    let error = String::from_utf8(result.stderr).unwrap();
    assert!(error.contains("[mokly/git-uncommitted]"));
    assert!(error.contains("/site\\[1\\]/"));
}

#[test]
fn an_in_repository_temporary_root_is_rejected_without_a_transient_write() {
    let directory = checkout();
    let timestamp = std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(946_684_800);
    #[cfg(unix)]
    fs::File::open(directory.path())
        .unwrap()
        .set_modified(timestamp)
        .unwrap();
    #[cfg(windows)]
    {
        fs::OpenOptions::new()
            .write(true)
            .custom_flags(0x02000000)
            .open(directory.path())
            .unwrap()
            .set_modified(timestamp)
            .unwrap();
    }
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(directory.path())
        .args([
            "publish",
            "--endpoint=https://example.com/plan",
            "--token=secret",
            "--no-changes",
            "--repository=example.com/team/project",
        ])
        .env("TMPDIR", directory.path())
        .env("TEMP", directory.path())
        .env("TMP", directory.path())
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_SIDECARS")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    let temporary_root = dunce::canonicalize(directory.path()).unwrap();
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        format!(
            "[mokly/export-invalid] The publish build directory could not be prepared. Temporary root: {}. Set TMPDIR, or TMP on Windows, to a writable directory outside the checkout.\n",
            temporary_root.display()
        )
    );
    assert_eq!(
        fs::metadata(directory.path()).unwrap().modified().unwrap(),
        timestamp
    );
}

#[test]
fn a_missing_temporary_root_names_the_path_and_environment_recovery() {
    let directory = checkout();
    let temporary = tempfile::tempdir().unwrap();
    let missing = temporary.path().join("missing");
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(directory.path())
        .args([
            "publish",
            "--endpoint=https://example.com/plan",
            "--token=secret",
            "--no-changes",
            "--repository=example.com/team/project",
        ])
        .env("TMPDIR", missing.join(""))
        .env("TEMP", missing.join(""))
        .env("TMP", missing.join(""))
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_SIDECARS")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    let path = missing.to_string_lossy();
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        format!(
            "[mokly/export-invalid] The publish build directory could not be prepared. Temporary root: {path}. Set TMPDIR, or TMP on Windows, to a writable directory outside the checkout.\n"
        )
    );
}
