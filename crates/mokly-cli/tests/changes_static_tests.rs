//! Static builds compare before warnings can reject installation or publication.

use std::fs;
use std::path::Path;

mod changes_support;
use changes_support::{base, git, run, write};

fn commit(root: &Path) {
    git(root, &["add", "-A"]);
    git(
        root,
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "-m",
            "head",
        ],
    );
}

#[test]
fn static_build_retains_changes_and_selects_the_explicit_base_once() {
    let root = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Before</p>",
    )]);
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>After</p>",
    );
    write(
        root.path(),
        "mokly.config.json",
        r#"{"review":{"base":"missing-configured-base"}}"#,
    );
    let output = run(root.path(), &["build", "--base", "fixture-base"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");
    assert!(stdout.contains("Built Mokly to mokly-static"), "{stdout}");
    assert_eq!(stdout.matches("Comparing with fixture-base").count(), 1);
    let index: serde_json::Value = serde_json::from_slice(
        &fs::read(root.path().join("mokly-static/mokly-viewer/index.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(index["base"], "fixture-base");
}

#[test]
fn base_dependency_warnings_gate_strict_static_builds_and_publish_after_comparison() {
    let root = base(&[
        (
            "mokly.config.json",
            r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
        ),
        ("postcss.mjs", "export default {plugins:[]};"),
        ("package.json", r#"{"name":"base-package"}"#),
        ("style.css", "p{color:red}"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Before</p>",
        ),
    ]);
    git(root.path(), &["branch", "base-point"]);
    write(root.path(), "package.json", r#"{"name":"head-package"}"#);
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>After</p>",
    );
    commit(root.path());
    for (verb, strict) in [("build", true), ("publish", true), ("publish", false)] {
        let mut args = vec![verb, "--base", "base-point"];
        if strict {
            args.push("--strict");
        }
        if verb == "build" {
            args.extend(["--out", ".context/strict"]);
        } else {
            args.extend([
                "--repository",
                "example.test/team/catalogue",
                "--endpoint",
                "http://127.0.0.1:1/plan",
                "--token",
                "fixture-token",
            ]);
        }
        let output = run(root.path(), &args);
        assert_eq!(
            output.status.code(),
            Some(1),
            "{verb}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(stderr.contains("base dependencies"), "{verb}: {stderr}");
        assert!(
            stderr.contains(if strict {
                "1 build warning with --strict"
            } else {
                "[mokly/upload-failed]"
            }),
            "{verb}: {stderr}"
        );
        assert!(!stderr.contains("upload-transport"), "{stderr}");
        assert!(String::from_utf8_lossy(&output.stdout).contains("Comparing with base-point"));
        if verb == "publish" && !strict {
            assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 1 change"));
        }
        assert!(!root.path().join(".context/strict/index.html").exists());
    }
    let output = run(root.path(), &["build", "--base", "base-point"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 1 change"));
    assert_eq!(
        String::from_utf8_lossy(&output.stderr)
            .matches("base dependencies")
            .count(),
        1
    );
}
