//! The native CLI computes HTML Changes and preserves invalid-base diagnostics.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use tempfile::TempDir;

fn write(root: &Path, path: &str, body: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
}

fn git(root: &Path, arguments: &[&str]) {
    let output = Command::new("git")
        .current_dir(root)
        .args(arguments)
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

fn run(root: &Path, arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(root)
        .args(arguments)
        .env("MOKLY_OUTPUT", "rich")
        .env_remove("CI")
        .output()
        .unwrap()
}

fn base(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        "mokly.config.json",
        "{\"review\":{\"base\":\"fixture-base\"}}",
    );
    for (path, body) in files {
        write(directory.path(), path, body);
    }
    git(directory.path(), &["init", "--initial-branch=fixture-base"]);
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
            "fixture base",
        ],
    );
    directory
}

#[test]
fn ready_counts_use_entry_membership_and_base_override_and_no_changes_stays_git_free() {
    let directory = base(&[
        (
            "specs/stable.screen.html",
            "---\ntitle: Stable\n---\n<p>Stable</p>",
        ),
        (
            "specs/ignored.screen.html",
            "---\ntitle: Ignored\n---\n<mokly-ignore id=\"chrome\">Before</mokly-ignore>",
        ),
        (
            "specs/changed.screen.html",
            "---\ntitle: Changed\n---\n<p>Before</p>",
        ),
        (
            "specs/removed.screen.html",
            "---\ntitle: Removed\n---\n<p>Removed</p>",
        ),
        (
            "specs/old.screen.html",
            "---\ntitle: Moved\n---\n<p>Moved</p>",
        ),
    ]);
    let root = directory.path();
    write(
        root,
        "specs/ignored.screen.html",
        "---\ntitle: Ignored\n---\n<mokly-ignore id=\"chrome\">After</mokly-ignore>",
    );
    write(
        root,
        "specs/changed.screen.html",
        "---\ntitle: Changed\n---\n<p>After</p>",
    );
    write(
        root,
        "specs/added.screen.html",
        "---\ntitle: Added\n---\n<p>Added</p>",
    );
    fs::remove_file(root.join("specs/removed.screen.html")).unwrap();
    fs::rename(
        root.join("specs/old.screen.html"),
        root.join("specs/new.screen.html"),
    )
    .unwrap();
    let output = run(root, &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout)
            .contains("Changes ready · 4 changes · 1 moved · 2 ignored-only")
    );
    write(
        root,
        "mokly.config.json",
        "{\"review\":{\"base\":\"absent\"}}",
    );
    let output = run(root, &["build", "--base", "fixture-base"]);
    assert!(output.stderr.is_empty());
    assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 4 changes"));
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(root)
        .args(["build", "--no-changes"])
        .env("PATH", "")
        .env("MOKLY_OUTPUT", "rich")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty());
    assert!(!String::from_utf8_lossy(&output.stdout).contains("Changes"));
}

#[test]
fn base_validation_failure_keeps_the_head_catalogue_and_prints_each_source_diagnostic() {
    let directory = base(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\nunexpected: true\n---\n<p>Home</p>",
        ),
        (
            "specs/other.screen.html",
            "---\ntitle: Other\nalsoBad: true\n---\n<p>Other</p>",
        ),
    ]);
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    );
    write(
        directory.path(),
        "specs/other.screen.html",
        "---\ntitle: Other\n---\n<p>Other</p>",
    );
    let output = run(directory.path(), &["build"]);
    assert_eq!(output.status.code(), Some(0));
    let stdout = String::from_utf8(output.stdout).unwrap();
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stdout.contains("Catalogue ready"));
    assert!(stdout.contains("Changes unavailable"));
    assert!(stderr.contains("unexpected"), "{stderr}");
    assert!(stderr.contains("alsoBad"), "{stderr}");
    assert!(stderr.contains("specs/home.screen.html"));
}

#[test]
fn strict_mode_counts_historical_preparation_warnings_before_any_output_write() {
    let directory = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<p>Home</p>",
    )]);
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<p>{{label}}</p>",
    );
    let output = run(directory.path(), &["build", "--strict"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(
        stderr
            .matches("prop \"label\" is not read by the body")
            .count(),
        1
    );
    assert!(stderr.contains("1 build warning with --strict"), "{stderr}");
    assert!(!directory.path().join("mokly-static").exists());
}

#[test]
fn a_javascript_renderer_is_unavailable_until_its_provider_is_connected() {
    let directory = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    )]);
    write(
        directory.path(),
        "renderer.tsx",
        "export default function render() {}\n",
    );
    write(
        directory.path(),
        "mokly.config.json",
        "{\"renderer\":\"renderer.tsx\"}",
    );
    let output = run(directory.path(), &["build", "--no-changes"]);
    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("renderer.tsx"));
}
