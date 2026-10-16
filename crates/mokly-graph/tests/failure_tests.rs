//! Final validation exercises real source files without writing generated output.

use std::fs;
use std::path::Path;

use tempfile::TempDir;

mod support;

fn catalogue(body: &str, target: &str) -> TempDir {
    let directory = TempDir::new().unwrap();
    fs::create_dir_all(directory.path().join("specs")).unwrap();
    fs::create_dir_all(directory.path().join("assets")).unwrap();
    fs::write(directory.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        directory.path().join("specs/home.screen.html"),
        format!("---\ntitle: Home\n---\n{body}"),
    )
    .unwrap();
    fs::write(
        directory.path().join("specs/target.screen.html"),
        format!("---\ntitle: Target\n---\n{target}"),
    )
    .unwrap();
    directory
}

#[test]
fn logical_anchors_must_exist_across_every_destination_view() {
    let directory = catalogue(
        "<a href=\"mock:target#mobile\">Target</a>",
        "<h1 id=\"mobile\" mokly-viewport=\"mobile\">Only mobile</h1>",
    );
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 3);
    let error = generation.unwrap().render_all().unwrap_err().to_string();
    assert!(error.contains("home/index."), "{error}");
    assert!(error.contains("target/index.desktop.html"), "{error}");
    assert!(error.contains("mobile"));
}

#[test]
fn a_referenced_document_keeps_its_composition_warnings_out_of_the_requesting_document() {
    let directory = catalogue(
        "<a href=\"mock:target#target\">Target</a>",
        "<h1 id=\"target\">Target</h1><button><span to=\"home\">Home</span></button>",
    );
    let (generation, cache) = support::prepare(directory.path(), 1024 * 1024, 2);
    let generation = generation.unwrap();
    let source = generation.render("home/index.mobile.html").unwrap();
    assert!(source.document.as_ref().unwrap().warnings.is_empty());
    assert!(cache.stats().entries > 0);
    for viewport in ["mobile", "desktop"] {
        let route = format!("target/index.{viewport}.html");
        let target = generation.render(&route).unwrap();
        let warnings = &target.document.as_ref().unwrap().warnings;
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "link-control-ancestor");
        assert_eq!(warnings[0].printed_subject(), route);
    }
    let source = generation.render("home/index.mobile.html").unwrap();
    assert!(source.document.as_ref().unwrap().warnings.is_empty());
}

#[test]
fn local_anchor_and_resource_failures_keep_the_referring_route() {
    for (body, expected) in [
        ("<a href=\"#missing\">Missing</a>", "missing anchor"),
        ("<img src=\"../../assets/missing.png\">", "missing target"),
        (
            "<img src=\"../../specs/private.source.ts\">",
            "reserved source basename",
        ),
        (
            "<img src=\"../../.hidden/file.png\">",
            "hidden path segment",
        ),
    ] {
        let directory = catalogue(body, "<h1>Target</h1>");
        fs::write(directory.path().join("specs/private.source.ts"), "private").unwrap();
        let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 2);
        let error = generation.unwrap().render_all().unwrap_err().to_string();
        assert!(error.contains(expected), "{error}");
        assert!(error.contains("home/index."), "{error}");
        assert!(!directory.path().join("mokly-static").exists());
    }
}

#[test]
fn public_closure_follows_html_css_srcset_hints_and_cycles() {
    let directory = catalogue(
        "<a href=\"../../assets/page.html\">Page</a><iframe src=\"../../assets/page.html\"></iframe><img srcset=\"../../assets/a.png 1x, ../../assets/b.png 2x\"><link rel=\"preload\" href=\"../../assets/public.css\">",
        "<h1>Target</h1>",
    );
    for (path, bytes) in [
        (
            "page.html",
            "<!doctype html><html><head><link rel=\"stylesheet\" href=\"public.css\"></head><body><a href=\"file.pdf\">PDF</a><script src=\"browser.js\"></script><a href=\"page.html\">Cycle</a></body></html>",
        ),
        (
            "public.css",
            "@import './nested.css'; .x {background:url('./a.png')}",
        ),
        (
            "nested.css",
            "@import './public.css'; .y {background:url('./b.png')}",
        ),
        ("a.png", "opaque-a"),
        ("b.png", "opaque-b"),
        ("file.pdf", "opaque-pdf"),
        ("browser.js", "window.product = true;"),
    ] {
        fs::write(directory.path().join("assets").join(path), bytes).unwrap();
    }
    let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 2);
    let generation = generation.unwrap();
    let full = generation.render_all().unwrap();
    let demand = generation.closure("home/index.mobile.html").unwrap();
    assert_eq!(full.closure, demand.files);
    assert_eq!(demand.files.len(), 7);
    assert!(demand.files.contains("assets/browser.js"));
    assert_eq!(demand.edges["static/assets/page.html"].len(), 4);
    assert_eq!(demand.evidence.len(), 7);
}

#[cfg(unix)]
#[test]
fn a_public_file_or_ancestor_symlink_fails_even_inside_the_repository() {
    for ancestor in [false, true] {
        let directory = catalogue(
            if ancestor {
                "<img src=\"../../alias/a.png\">"
            } else {
                "<img src=\"../../assets/alias.png\">"
            },
            "<h1>Target</h1>",
        );
        fs::write(directory.path().join("assets/a.png"), "opaque").unwrap();
        if ancestor {
            std::os::unix::fs::symlink(
                directory.path().join("assets"),
                directory.path().join("alias"),
            )
            .unwrap();
        } else {
            std::os::unix::fs::symlink(
                directory.path().join("assets/a.png"),
                directory.path().join("assets/alias.png"),
            )
            .unwrap();
        }
        let (generation, _) = support::prepare(directory.path(), 1024 * 1024, 1);
        assert!(
            generation
                .unwrap()
                .render_all()
                .unwrap_err()
                .to_string()
                .contains("symbolic link")
        );
    }
}

#[test]
fn source_and_resource_edits_move_only_their_document_input_keys() {
    let directory = catalogue(
        "<h1>Home</h1><img src=\"../../assets/a.png\">",
        "<h1>Target</h1>",
    );
    fs::write(directory.path().join("assets/a.png"), "before").unwrap();
    let (before, _) = support::prepare(directory.path(), 0, 1);
    let before = before.unwrap();
    fs::write(directory.path().join("assets/a.png"), "after").unwrap();
    let (after, _) = support::prepare(directory.path(), 0, 1);
    let after = after.unwrap();
    assert_ne!(
        before.plans()["home/index.mobile.html"].key,
        after.plans()["home/index.mobile.html"].key
    );
    assert_eq!(
        before.plans()["target/index.mobile.html"].key,
        after.plans()["target/index.mobile.html"].key
    );
    fs::write(
        directory.path().join("specs/target.screen.html"),
        "---\ntitle: Target\n---\n<h1>Edited</h1>",
    )
    .unwrap();
    let (edited, _) = support::prepare(directory.path(), 0, 1);
    let edited = edited.unwrap();
    assert_ne!(
        edited.plans()["target/index.mobile.html"].key,
        after.plans()["target/index.mobile.html"].key
    );
    assert_eq!(
        edited.plans()["home/index.mobile.html"].key,
        after.plans()["home/index.mobile.html"].key
    );
    assert_eq!(
        before.plans().keys().collect::<Vec<_>>(),
        after.plans().keys().collect::<Vec<_>>()
    );
}

#[test]
fn opaque_generated_assets_keep_generation_bytes_after_eviction() {
    let directory = catalogue("<h1>Home</h1>", "<h1>Target</h1>");
    fs::create_dir(directory.path().join("css")).unwrap();
    fs::write(
        directory.path().join("mokly.config.json"),
        r#"{"stylesheets":[{"match":"home/**","stylesheets":["css/base.css"]}]}"#,
    )
    .unwrap();
    fs::write(
        directory.path().join("css/base.css"),
        ".x{background:url('../assets/a.png')}",
    )
    .unwrap();
    fs::write(directory.path().join("assets/a.png"), "before").unwrap();
    let (before, _) = support::prepare(directory.path(), 0, 1);
    let before = before.unwrap();
    fs::write(directory.path().join("assets/a.png"), "after").unwrap();
    let (after, _) = support::prepare(directory.path(), 0, 1);
    let after = after.unwrap();
    assert_eq!(
        before.resource("assets/assets/a.png").unwrap().unwrap(),
        b"before"
    );
    assert_eq!(
        after.resource("assets/assets/a.png").unwrap().unwrap(),
        b"after"
    );
    assert_ne!(
        before.plans()["home/index.mobile.html"].key,
        after.plans()["home/index.mobile.html"].key
    );
    assert_eq!(
        before.plans()["target/index.mobile.html"].key,
        after.plans()["target/index.mobile.html"].key
    );
    assert!(Path::new(directory.path()).join("css/base.css").is_file());
}
