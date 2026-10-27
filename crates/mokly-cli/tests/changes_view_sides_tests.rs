//! A view that only one side renders proves render impact only for an entry
//! that exists on one side. Views that an entry gains or loses leave its
//! consumers unaffected, and a removed component keeps its former consumers.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

mod changes_support;
use changes_support::{base, run, write};

const LIGHT_AND_DARK: &str =
    r#"{"colorSchemes":["light","dark"],"review":{"base":"fixture-base"}}"#;
const HOME: &str = "---\ntitle: Home\n---\n<main><x-badge label=\"New\"></x-badge></main>";

/// The Badge component source, with `extra` front matter lines before its end.
fn badge(extra: &str) -> String {
    format!(
        "---\ntitle: Badge\nelement: x-badge\npropSchema: {{type: object, additionalProperties: false, properties: {{label: {{type: string}}}}}}\nprops: {{label: Badge}}\n{extra}---\n<i>{{{{label}}}}</i>"
    )
}

/// Build against the fixture base and return the static output directory.
fn build(root: &Path) -> PathBuf {
    let output = run(root, &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    root.join("mokly-static")
}

/// The published detail of one current entry or saved variant.
fn detail(site: &Path, path: &str) -> Value {
    serde_json::from_slice(
        &fs::read(site.join(format!("mokly-viewer/entries/{path}.json"))).unwrap(),
    )
    .unwrap()
}

/// The changed components that one entry's detail names as affecting it.
fn related(site: &Path, path: &str) -> Value {
    detail(site, path)["workspace"]["relatedComponents"].clone()
}

/// Each view's scheme and state, in view order.
fn states(detail: &Value) -> Vec<(&str, &str)> {
    detail["views"]
        .as_array()
        .unwrap()
        .iter()
        .map(|view| {
            (
                view["colorScheme"].as_str().unwrap(),
                view["state"].as_str().unwrap(),
            )
        })
        .collect()
}

#[test]
fn a_component_that_loses_dark_keeps_its_light_views_without_affected_consumers() {
    let source = badge("");
    let directory = base(&[
        ("mokly.config.json", LIGHT_AND_DARK),
        ("specs/badge.component.html", source.as_str()),
        ("specs/home.screen.html", HOME),
    ]);
    write(
        directory.path(),
        "specs/badge.component.html",
        &badge("colorSchemes: [light]\n"),
    );
    let site = build(directory.path());
    // A lost view has no head counterpart, so it proves no render impact.
    assert_eq!(related(&site, "home"), json!([]));
    let badge = detail(&site, "badge");
    assert_eq!(badge["reasons"], json!([{"kind": "metadata"}]));
    assert_eq!(
        states(&badge),
        [("light", "unchanged"), ("light", "unchanged")]
    );
    assert!(detail(&site, "home").get("reasons").is_none());
}

#[test]
fn a_variant_that_gains_dark_lists_added_views_without_affected_consumers() {
    let source = badge("variants: [{slug: bold, title: Bold, props: {label: Bold}}]\n");
    let directory = base(&[
        ("specs/badge.component.html", source.as_str()),
        ("specs/home.screen.html", HOME),
    ]);
    write(directory.path(), "mokly.config.json", LIGHT_AND_DARK);
    let site = build(directory.path());
    // A gained view has no base counterpart, so it proves no render impact.
    assert_eq!(related(&site, "home"), json!([]));
    let bold = detail(&site, "badge/bold");
    assert_eq!(bold["reasons"], json!([{"kind": "metadata"}]));
    assert_eq!(
        states(&bold),
        [
            ("light", "unchanged"),
            ("dark", "added"),
            ("light", "unchanged"),
            ("dark", "added"),
        ]
    );
}

#[test]
fn a_removed_component_keeps_its_former_consumer_affected() {
    let source = badge("");
    let directory = base(&[
        ("specs/badge.component.html", source.as_str()),
        ("specs/home.screen.html", HOME),
    ]);
    fs::remove_file(directory.path().join("specs/badge.component.html")).unwrap();
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<main><i>New</i></main>",
    );
    let site = build(directory.path());
    let index: Value =
        serde_json::from_slice(&fs::read(site.join("mokly-viewer/index.json")).unwrap()).unwrap();
    let generation = site.join(index["comparisonUrl"].as_str().unwrap());
    let removed: Value =
        serde_json::from_slice(&fs::read(generation.join("entries/badge.json")).unwrap()).unwrap();
    assert_eq!(removed["reasons"], json!([{"kind": "removed"}]));
    // A removed component exists on one side, so its base views prove impact
    // and its former consumer stays affected through the base usage.
    assert_eq!(
        related(&site, "home"),
        json!([{"path": "badge", "title": "Badge"}])
    );
}
