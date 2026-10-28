//! HTML repair observes the final element names after link-control adaptation.

use std::fs;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::{parse, serialize};
use tempfile::TempDir;

mod support;

fn fixture(body: &str) -> TempDir {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        format!("---\ntitle: Home\n---\n{body}"),
    )
    .unwrap();
    fs::write(root.path().join("specs/card.component.html"), "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<div class=\"card\">Card</div>").unwrap();
    fs::write(root.path().join("specs/page.page.html"), "---\ntitle: Page\n---\n<!doctype html><html><head><title>Page</title></head><body>Page</body></html>").unwrap();
    root
}

#[test]
fn a_control_adapted_to_an_anchor_is_valid_inside_a_paragraph() {
    let root = fixture("<p>Intro <ui-card to=\"page\"></ui-card> tail</p>");
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    let artifact = generation.render("home/index.mobile.html").unwrap();
    assert!(artifact.document.as_ref().unwrap().warnings.is_empty());
    let html = String::from_utf8(artifact.bytes.clone()).unwrap();
    assert!(html.contains("<p>Intro <!--mokly-instance:start"));
    assert!(html.contains("<a class=\"card\""));
    assert_eq!(
        serialize::html(&parse::html(DeliveredHtml::document(&html))),
        html
    );
}

#[test]
fn explicit_nested_link_controls_keep_their_validation_failure() {
    let root = fixture("<a><ui-card to=\"page\"></ui-card></a>");
    let generation = support::prepare(root.path(), 8 * 1024 * 1024, 1).0.unwrap();
    assert!(generation.render("home/index.mobile.html").is_err());
}
