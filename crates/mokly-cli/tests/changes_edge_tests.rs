//! Missing base configuration and retained comparison limits preserve the current build.

use std::fs;

use tempfile::TempDir;

mod changes_support;
use changes_support::{base, git, run, write};

#[test]
fn a_catalogue_added_after_the_base_has_every_current_entry_added() {
    let root = TempDir::new().unwrap();
    git(root.path(), &["init", "--initial-branch=fixture-base"]);
    git(
        root.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "--allow-empty",
            "-m",
            "empty base",
        ],
    );
    write(root.path(), "mokly.config.json", "{}");
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    );
    write(root.path(), "specs/guide.md", "# Guide");
    let output = run(root.path(), &["build", "--base", "fixture-base"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 2 changes"));
}

#[test]
fn a_base_source_over_the_byte_limit_keeps_the_build_valid_and_names_the_path() {
    let directory = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    )]);
    let path = directory.path().join("specs/home.screen.html");
    fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_len(70 * 1024 * 1024)
        .unwrap();
    git(directory.path(), &["add", "."]);
    git(
        directory.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "-m",
            "oversized base source",
        ],
    );
    fs::write(&path, "---\ntitle: Home\n---\n<p>Home</p>").unwrap();
    let result = run(directory.path(), &["build", "--strict"]);
    assert_eq!(
        result.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(
        String::from_utf8_lossy(&result.stdout)
            .contains("Changes unavailable · comparison limit reached")
    );
    let stderr = String::from_utf8_lossy(&result.stderr);
    assert!(stderr.contains("specs/home.screen.html"), "{stderr}");
    assert!(stderr.contains("67108864"), "{stderr}");
    assert!(!stderr.contains("git-failed"), "{stderr}");
}
