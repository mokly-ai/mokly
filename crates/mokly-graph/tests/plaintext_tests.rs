//! Composed plaintext cannot turn private repair attributes into visible text.

use std::fs;

use mokly_html::tree::{self, Node};
use mokly_html::{parse, serialize};
use tempfile::TempDir;

mod support;

#[test]
fn plaintext_component_in_active_formatting_has_no_private_metadata() {
    for prefix in ["", "<i>Earlier unrelated content</i>"] {
        let root = TempDir::new().unwrap();
        fs::create_dir(root.path().join("specs")).unwrap();
        fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
        fs::write(
            root.path().join("specs/home.screen.html"),
            format!("---\ntitle: Home\n---\n{prefix}<p><b><ui-card></ui-card></b></p>"),
        )
        .unwrap();
        fs::write(root.path().join("specs/card.component.html"), "---\ntitle: Card\nelement: ui-card\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<plaintext>abc").unwrap();
        let generation = support::prepare(root.path(), 0, 1).0.unwrap();
        let artifact = generation.render("home/index.mobile.html").unwrap();
        let html = std::str::from_utf8(&artifact.bytes).unwrap();
        assert!(html.contains("<plaintext><b>abc</b>"), "{html}");
        assert!(!html.contains("mokly-normalize"), "{html}");
        for node in tree::walk(&artifact.document.as_ref().unwrap().tree) {
            if let Node::Text(text) = node {
                assert!(!text.contains("mokly-normalize"), "{text}");
            }
        }
        let parsed = parse::delivered_document(html);
        assert_eq!(parsed, parse::delivered_document(&serialize::html(&parsed)));
        assert_eq!(html, serialize::html(&parsed));
    }
}
