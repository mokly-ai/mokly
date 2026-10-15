//! The native CLI computes HTML Changes and preserves invalid-base diagnostics.

use std::fs;
use std::process::Command;

mod changes_support;
use changes_support::{base, run, run_with_node, write};

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
            .contains("Changes ready · 4 changes · 1 moved · 1 ignored-only")
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
    assert!(stderr.contains("base "));
    assert!(!stderr.contains("review-invalid"));
    assert!(!stderr.contains("✖"));
    assert!(stdout.contains("Changes unavailable · base validation failed"));
}

#[test]
fn strict_mode_ignores_fixed_historical_authoring_warnings() {
    let directory = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<p>Home</p>",
    )]);
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<p>{{label}}</p>",
    );
    for options in [&["build", "--strict"][..], &["build"][..]] {
        let output = run(directory.path(), options);
        assert_eq!(
            output.status.code(),
            Some(0),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
    }
}

#[test]
fn a_configured_renderer_is_bundled_even_for_an_html_catalogue() {
    let directory = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>",
    )]);
    write(directory.path(), "renderer.tsx", "export default ???;\n");
    write(
        directory.path(),
        "mokly.config.json",
        "{\"renderer\":\"renderer.tsx\"}",
    );
    let output = run(directory.path(), &["build", "--no-changes"]);
    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("renderer.tsx"));
}

#[test]
fn html_only_changes_need_neither_node_nor_an_extraction_cache() {
    let root = base(&[(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Before</p>",
    )]);
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>After</p>",
    );
    let output = run_with_node(
        root.path(),
        &["build"],
        Some(&root.path().join("missing-node")),
    );
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");
    assert!(!stdout.contains("  cache "), "{stdout}");
    assert!(output.stderr.is_empty());
}
