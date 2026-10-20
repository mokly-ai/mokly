//! A view that only one side renders proves render impact only for an entry
//! that exists on one side. Views that an entry gains or loses leave its
//! consumers unaffected, and a removed component keeps its former consumers.

use std::fs;
use std::iter;
use std::path::Path;

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

/// Build against the fixture base and read the published review result.
fn review(root: &Path) -> Value {
    let output = run(root, &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let site = root.join("mokly-static");
    let index: Value =
        serde_json::from_slice(&fs::read(site.join("mokly-viewer/index.json")).unwrap()).unwrap();
    serde_json::from_slice(&fs::read(site.join(index["comparisonUrl"].as_str().unwrap())).unwrap())
        .unwrap()
}

/// The review record of one entry or saved variant.
fn entry<'a>(review: &'a Value, path: &str) -> &'a Value {
    review["entries"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|entry| {
            iter::once(entry).chain(entry["variants"].as_array().into_iter().flatten())
        })
        .find(|entry| entry["path"] == path)
        .unwrap()
}

/// Each view's scheme and state, in view order.
fn states(entry: &Value) -> Vec<(&str, &str)> {
    entry["views"]
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
fn a_component_that_loses_dark_lists_removed_views_without_affected_consumers() {
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
    let review = review(directory.path());
    // A lost view has no head counterpart, so it proves no render impact.
    assert_eq!(review["affected"], json!([]));
    let badge = entry(&review, "badge");
    assert_eq!(badge["reasons"], json!([{"kind": "metadata"}]));
    assert_eq!(
        states(badge),
        [
            ("light", "unchanged"),
            ("dark", "removed"),
            ("light", "unchanged"),
            ("dark", "removed"),
        ]
    );
    assert_eq!(entry(&review, "home")["reasons"], json!([]));
}

#[test]
fn a_variant_that_gains_dark_lists_added_views_without_affected_consumers() {
    let source = badge("variants: [{slug: bold, title: Bold, props: {label: Bold}}]\n");
    let directory = base(&[
        ("specs/badge.component.html", source.as_str()),
        ("specs/home.screen.html", HOME),
    ]);
    write(directory.path(), "mokly.config.json", LIGHT_AND_DARK);
    let review = review(directory.path());
    // A gained view has no base counterpart, so it proves no render impact.
    assert_eq!(review["affected"], json!([]));
    let bold = entry(&review, "badge/bold");
    assert_eq!(bold["reasons"], json!([{"kind": "metadata"}]));
    assert_eq!(
        states(bold),
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
    let review = review(directory.path());
    assert_eq!(
        entry(&review, "badge")["reasons"],
        json!([{"kind": "removed"}])
    );
    // A removed component exists on one side, so its base views prove impact
    // and its former consumer stays affected through the base usage.
    let affected = review["affected"].as_array().unwrap();
    assert_eq!(affected.len(), 1);
    assert_eq!(affected[0]["changedComponentId"], "badge");
    assert_eq!(
        affected[0]["consumer"],
        json!({"kind": "screen", "path": "home"})
    );
    let evidence: Vec<_> = affected[0]["evidence"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| {
            (
                item["side"].as_str().unwrap(),
                item["context"]["viewport"].as_str().unwrap(),
            )
        })
        .collect();
    assert_eq!(evidence, [("before", "mobile"), ("before", "desktop")]);
}
