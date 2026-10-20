//! HTML comparisons reuse installed package CSS and warn on different dependency identities.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use serde_json::Value;
use tempfile::TempDir;

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn git(root: &Path, args: &[&str]) {
    let result = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    git(root.path(), &["init", "-q"]);
    git(root.path(), &["config", "user.name", "Fixture"]);
    git(
        root.path(),
        &["config", "user.email", "fixture@example.test"],
    );
    write(root.path(), ".gitignore", ".context/\nnode_modules/\n");
    write(root.path(), ".gitattributes", "package.json text eol=lf\n");
    write(
        root.path(),
        "package.json",
        "{\n  \"dependencies\": {\"theme\": \"1.0.0\"}\n}\n",
    );
    write(
        root.path(),
        "package-lock.json",
        "{\"lockfileVersion\":3,\"packages\":{}}\n",
    );
    write(
        root.path(),
        "mokly.config.json",
        r#"{"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
    );
    write(root.path(), "style.css", "@import 'theme/theme.css';");
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p class=\"theme\">Home</p>",
    );
    write(
        root.path(),
        "node_modules/theme/package.json",
        r#"{"name":"theme","version":"2.0.0"}"#,
    );
    write(
        root.path(),
        "node_modules/theme/theme.css",
        ".theme{color:blue;padding:7px}",
    );
    git(root.path(), &["add", "-A"]);
    git(root.path(), &["commit", "-qm", "base"]);
    git(root.path(), &["branch", "fixture-base"]);
    root
}

fn build(root: &Path, strict: bool) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command.args(["build", "--base", "fixture-base", "--out", ".context/site"]);
    if strict {
        command.arg("--strict");
    }
    command
        .current_dir(root)
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_NODE_EXECUTABLE", root.join("missing-node"))
        .output()
        .unwrap()
}

#[test]
fn html_package_upgrade_warns_without_node_and_strict_preserves_the_old_output() {
    let root = fixture();
    let first = build(root.path(), true);
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    assert!(!String::from_utf8_lossy(&first.stderr).contains("Base dependencies differ."));
    let index_path = root.path().join(".context/site/mokly-viewer/index.json");
    let original = fs::read(&index_path).unwrap();
    write(
        root.path(),
        "package.json",
        "{\"dependencies\":{\"theme\":\"2.0.0\"}}",
    );
    let strict = build(root.path(), true);
    assert_eq!(strict.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&strict.stderr).contains("Base dependencies differ."));
    assert_eq!(fs::read(&index_path).unwrap(), original);
    let result = build(root.path(), false);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let stderr = String::from_utf8_lossy(&result.stderr);
    assert!(stderr.contains("Base dependencies differ."), "{stderr}");
    assert!(stderr.contains("working-tree dependencies"), "{stderr}");
    let index: Value = serde_json::from_slice(&fs::read(index_path).unwrap()).unwrap();
    assert_eq!(index["changesStatus"], "ready");
    assert_eq!(index["screens"][0]["changes"]["included"], false);
    assert!(
        fs::read_to_string(
            root.path()
                .join(".context/site/static/mokly-generated/styles/style.css")
        )
        .unwrap()
        .contains("7px")
    );
}

#[test]
fn html_dependency_warning_uses_clean_identity_and_detects_lockfile_only_edits() {
    let root = fixture();
    let manifest = fs::read_to_string(root.path().join("package.json")).unwrap();
    write(root.path(), "package.json", &manifest.replace('\n', "\r\n"));
    let equal = build(root.path(), true);
    assert!(
        equal.status.success(),
        "{}",
        String::from_utf8_lossy(&equal.stderr)
    );
    assert!(!String::from_utf8_lossy(&equal.stderr).contains("Base dependencies differ."));
    write(
        root.path(),
        "package-lock.json",
        "{\"lockfileVersion\":3,\"packages\":{\"node_modules/theme\":{\"version\":\"2.0.0\"}}}",
    );
    let changed = build(root.path(), false);
    assert!(
        changed.status.success(),
        "{}",
        String::from_utf8_lossy(&changed.stderr)
    );
    assert!(String::from_utf8_lossy(&changed.stderr).contains("Base dependencies differ."));
}
