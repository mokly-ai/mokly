//! Git selection and current closure failures abort build with their exact categories.

use std::fs;
use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

fn git(root: &Path, args: &[&str]) {
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn catalogue() -> TempDir {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<p>Home</p>",
    )
    .unwrap();
    root
}

fn commit(root: &Path) {
    git(root, &["add", "."]);
    git(
        root,
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "-m",
            "fixture",
        ],
    );
}

fn failure(root: &Path, reference: &str, code: &str) -> String {
    let result = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(root)
        .args(["build", "--base", reference])
        .env("MOKLY_OUTPUT", "plain")
        .output()
        .unwrap();
    assert_eq!(result.status.code(), Some(1));
    assert!(result.stdout.is_empty());
    let stderr = String::from_utf8(result.stderr).unwrap();
    assert!(stderr.contains(code), "{stderr}");
    if code == "git-failed" {
        assert_eq!(stderr.matches("[mokly/git-failed]").count(), 1, "{stderr}");
    }
    assert!(!stderr.contains("Some(128)"), "{stderr}");
    assert!(
        !stderr.contains("[mokly-compare/") && !stderr.contains("[mokly-git/"),
        "{stderr}"
    );
    assert!(!root.join("mokly-static").exists());
    stderr
}

#[test]
fn missing_repository_and_missing_ref_fail_with_git_failed_and_the_ref() {
    let root = catalogue();
    assert!(failure(root.path(), "required-base", "git-failed").contains("required-base"));
    git(root.path(), &["init", "--initial-branch=fixture-base"]);
    commit(root.path());
    fs::write(
        root.path().join("specs/home.screen.html"),
        "invalid current front matter",
    )
    .unwrap();
    assert!(failure(root.path(), "no-such-ref", "git-failed").contains("no-such-ref"));
}

#[test]
fn shallow_history_without_a_merge_base_fails_even_when_both_refs_exist() {
    let source = catalogue();
    let transport_root = source.path().join("history %20 #");
    fs::create_dir(&transport_root).unwrap();
    for name in ["mokly.config.json", "specs"] {
        fs::rename(source.path().join(name), transport_root.join(name)).unwrap();
    }
    git(&transport_root, &["init", "--initial-branch=fixture-base"]);
    commit(&transport_root);
    git(&transport_root, &["branch", "comparison-base"]);
    fs::write(transport_root.join("revision"), "new").unwrap();
    commit(&transport_root);
    let root = TempDir::new().unwrap();
    git(
        root.path(),
        &[
            "clone",
            "--no-local",
            "--depth=1",
            "--branch=fixture-base",
            transport_root.to_str().unwrap(),
            ".",
        ],
    );
    assert!(root.path().join(".git/shallow").is_file());
    git(
        root.path(),
        &[
            "fetch",
            "--depth=1",
            "origin",
            "comparison-base:refs/remotes/origin/comparison-base",
        ],
    );
    fs::write(
        root.path().join("specs/home.screen.html"),
        "invalid current front matter",
    )
    .unwrap();
    assert!(
        failure(root.path(), "origin/comparison-base", "git-failed")
            .contains("origin/comparison-base")
    );
}

#[test]
fn deleting_a_current_referenced_resource_is_build_invalid() {
    let root = catalogue();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<img src=\"../../image.svg\">",
    )
    .unwrap();
    fs::write(root.path().join("image.svg"), "image").unwrap();
    git(root.path(), &["init", "--initial-branch=fixture-base"]);
    commit(root.path());
    fs::remove_file(root.path().join("image.svg")).unwrap();
    assert!(failure(root.path(), "fixture-base", "build-invalid").contains("missing target"));
}

#[test]
fn a_missing_historical_blob_is_git_failed_instead_of_unavailable_validation() {
    let root = catalogue();
    git(root.path(), &["init", "--initial-branch=fixture-base"]);
    commit(root.path());
    let blob = Command::new("git")
        .current_dir(root.path())
        .args(["rev-parse", "HEAD:specs/home.screen.html"])
        .output()
        .unwrap();
    assert!(blob.status.success());
    let hash = String::from_utf8(blob.stdout).unwrap();
    let hash = hash.trim();
    fs::remove_file(
        root.path()
            .join(".git/objects")
            .join(&hash[..2])
            .join(&hash[2..]),
    )
    .unwrap();
    let commit = Command::new("git")
        .current_dir(root.path())
        .args(["rev-parse", "HEAD"])
        .output()
        .unwrap();
    let commit = String::from_utf8(commit.stdout).unwrap();
    let message = failure(root.path(), "fixture-base", "git-failed");
    assert!(message.contains(commit.trim()), "{message}");
    assert!(message.contains("base object"), "{message}");
    assert!(message.contains("git fetch origin"), "{message}");
    assert!(message.contains("fixture-base"), "{message}");
}
