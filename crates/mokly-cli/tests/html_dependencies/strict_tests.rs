//! Strict mode prints the dependency warning but counts only the other warnings.

use std::path::Path;
use std::process::{Command, Output};

use tempfile::TempDir;

use super::{WARNING_LINE, build, fixture, git, write};

/// Publish to an unreachable endpoint, so a passed build step ends at the upload.
fn strict_publish(root: &Path) -> Output {
    let temporary = TempDir::new().unwrap();
    let temporary_root = dunce::canonicalize(temporary.path()).unwrap();
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args([
            "publish",
            "--base",
            "fixture-base",
            "--strict",
            "--repository",
            "example.test/team/catalogue",
            "--endpoint",
            "http://127.0.0.1:1/plan",
            "--token",
            "fixture-token",
        ])
        .current_dir(root)
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_NODE_EXECUTABLE", root.join("missing-node"))
        .env("TMPDIR", &temporary_root)
        .env("TMP", &temporary_root)
        .env("TEMP", &temporary_root)
        .env_remove("MOKLY_ENDPOINT")
        .env_remove("MOKLY_TOKEN")
        .env_remove("GITHUB_ACTIONS")
        .output()
        .unwrap()
}

#[test]
fn a_strict_publish_with_differing_dependency_files_passes_its_build_step() {
    let root = fixture();
    write(
        root.path(),
        "package.json",
        "{\"dependencies\":{\"theme\":\"2.0.0\"}}",
    );
    git(root.path(), &["commit", "-qam", "upgrade theme"]);
    let output = strict_publish(root.path());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(1), "{stderr}");
    assert_eq!(stderr.matches(WARNING_LINE).count(), 1, "{stderr}");
    assert!(stderr.contains("[mokly/upload-failed]"), "{stderr}");
    assert!(!stderr.contains("with --strict"), "{stderr}");
}

#[test]
fn a_strict_build_with_one_other_warning_fails_and_counts_only_that_warning() {
    let root = fixture();
    write(
        root.path(),
        "package.json",
        "{\"dependencies\":{\"theme\":\"2.0.0\"}}",
    );
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<p class=\"theme\">Home</p>",
    );
    let result = build(root.path(), true);
    assert_eq!(result.status.code(), Some(1));
    assert_eq!(
        String::from_utf8_lossy(&result.stderr),
        format!(
            "{WARNING_LINE}[mokly/warning] entry \"home\": prop \"label\" is not read by the body\n[mokly/build-invalid] 1 build warning with --strict\n"
        )
    );
    assert!(!root.path().join(".context/site").exists());
}
