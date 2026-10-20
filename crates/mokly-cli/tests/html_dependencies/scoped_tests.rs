//! HTML warnings cover used dependency roots without repository-wide inventories.

use std::fs;
use std::process::Command;

use serde_json::Value;

use super::{build, fixture, git, write};

#[path = "large.rs"]
mod large;

const WARNING: &str = "Base dependencies differ. HTML comparison uses working-tree dependencies.";

#[test]
fn a_catalogue_without_dependency_usage_ignores_manifest_and_lockfile_edits() {
    let root = fixture();
    write(root.path(), "style.css", ".theme{color:blue}");
    git(root.path(), &["add", "style.css"]);
    git(root.path(), &["commit", "-qm", "local styles"]);
    git(root.path(), &["branch", "-f", "fixture-base"]);
    write(root.path(), "package.json", "{\"name\":\"unrelated\"}");
    write(root.path(), "package-lock.json", "{\"lockfileVersion\":3}");
    let result = build(root.path(), true);
    let stderr = String::from_utf8_lossy(&result.stderr);
    assert!(result.status.success(), "{stderr}");
    assert!(!stderr.contains(WARNING), "{stderr}");
}

#[test]
fn an_unrelated_manifest_edit_keeps_a_package_stylesheet_comparison_silent() {
    let root = fixture();
    write(
        root.path(),
        "unrelated/package.json",
        "{\"name\":\"original\"}",
    );
    git(root.path(), &["add", "unrelated/package.json"]);
    git(root.path(), &["commit", "-qm", "unrelated package"]);
    git(root.path(), &["branch", "-f", "fixture-base"]);
    write(
        root.path(),
        "unrelated/package.json",
        "{\"name\":\"unrelated\"}",
    );
    let result = build(root.path(), true);
    let stderr = String::from_utf8_lossy(&result.stderr);
    assert!(result.status.success(), "{stderr}");
    assert!(!stderr.contains(WARNING), "{stderr}");
}

#[test]
fn a_used_nested_lockfile_warns_and_fails_strict_after_unrelated_edits_stay_silent() {
    let root = fixture();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"stylesheets":[{"match":"**","stylesheets":["style.css"]}],"moduleResolution":{"packageRoots":["frontend"]}}"#,
    );
    fs::create_dir_all(root.path().join("frontend")).unwrap();
    fs::rename(
        root.path().join("node_modules"),
        root.path().join("frontend/node_modules"),
    )
    .unwrap();
    write(
        root.path(),
        "frontend/package.json",
        "{\"name\":\"frontend\"}",
    );
    write(
        root.path(),
        "frontend/package-lock.json",
        "{\"lockfileVersion\":3}",
    );
    git(root.path(), &["add", "-A"]);
    git(
        root.path(),
        &["commit", "-qm", "nested dependency directory"],
    );
    git(root.path(), &["branch", "-f", "fixture-base"]);
    write(
        root.path(),
        "unused/package-lock.json",
        "{\"lockfileVersion\":3}",
    );
    let silent = build(root.path(), true);
    assert!(
        silent.status.success(),
        "{}",
        String::from_utf8_lossy(&silent.stderr)
    );
    let index = root.path().join(".context/site/mokly-viewer/index.json");
    let previous = fs::read(&index).unwrap();
    write(
        root.path(),
        "frontend/package-lock.json",
        "{\"lockfileVersion\":3,\"packages\":{}}",
    );
    let strict = build(root.path(), true);
    assert_eq!(strict.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&strict.stderr).contains(WARNING));
    assert_eq!(fs::read(&index).unwrap(), previous);
    let permissive = build(root.path(), false);
    assert!(
        permissive.status.success(),
        "{}",
        String::from_utf8_lossy(&permissive.stderr)
    );
    assert!(String::from_utf8_lossy(&permissive.stderr).contains(WARNING));
}

#[test]
fn dependency_preparation_uses_exact_git_paths_and_never_lists_the_whole_tree() {
    let root = fixture();
    let trace_root = tempfile::tempdir().unwrap();
    let trace = trace_root.path().join("git.jsonl");
    let result = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args([
            "build",
            "--base",
            "fixture-base",
            "--out",
            ".context/site",
            "--strict",
        ])
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_NODE_EXECUTABLE", root.path().join("missing-node"))
        .env("GIT_TRACE2_EVENT", &trace)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let records = fs::read_to_string(trace).unwrap();
    let commands = records
        .lines()
        .filter_map(|line| {
            let record: Value = serde_json::from_str(line).unwrap();
            (record["event"] == "start").then(|| {
                record["argv"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|arg| arg.as_str().unwrap().to_owned())
                    .collect::<Vec<_>>()
            })
        })
        .collect::<Vec<_>>();
    let trees = commands
        .iter()
        .filter(|args| args.iter().any(|arg| arg == "ls-tree"))
        .collect::<Vec<_>>();
    assert!(
        !trees.is_empty(),
        "Git command capture must observe tree reads"
    );
    assert_eq!(
        trees
            .iter()
            .filter(|args| args.last().is_some_and(|arg| arg == "--"))
            .count(),
        0,
        "{trees:?}"
    );
    assert!(
        !commands
            .iter()
            .any(|args| args.iter().any(|arg| arg == "ls-files")),
        "{commands:?}"
    );
    assert!(
        trees
            .iter()
            .any(|args| args.iter().any(|arg| arg == "package-lock.json")
                && !args.iter().any(|arg| arg == "-r")),
        "{trees:?}"
    );
}

#[test]
fn an_unrelated_base_tree_above_the_listing_limit_keeps_html_changes_ready() {
    let root = fixture();
    large::add_unrelated_tree(root.path());
    let result = build(root.path(), true);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let index: Value = serde_json::from_slice(
        &fs::read(root.path().join(".context/site/mokly-viewer/index.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(
        index["changesStatus"],
        "ready",
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(!String::from_utf8_lossy(&result.stderr).contains(WARNING));
}
