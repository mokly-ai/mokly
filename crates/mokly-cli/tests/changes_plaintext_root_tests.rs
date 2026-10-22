//! A plaintext component keeps valid root inspection metadata in static output.

use std::fs;

use mokly_model::public_detail::EntryDetailV2;
use mokly_model::usage::{CatalogueUsage, ComponentRangeTarget};

mod changes_support;

#[test]
fn static_plaintext_component_owns_its_root_after_browser_repair() {
    for body in [
        "<plaintext>Note & &amp; <b>literal</b>",
        "<main><p>Before</p><plaintext>Note & &amp; <b>literal</b>",
    ] {
        let source = format!(
            "---\ntitle: Note\nelement: ui-note\npropSchema: {{type: object, additionalProperties: false, properties: {{}}}}\n---\n{body}"
        );
        let root = changes_support::base(&[("specs/note.component.html", &source)]);
        let output = changes_support::run(root.path(), &["build", "--strict", "--no-changes"]);
        assert!(
            output.status.success(),
            "{body}\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let site = root.path().join("mokly-static");
        let detail: EntryDetailV2 =
            serde_json::from_slice(&fs::read(site.join("mokly-viewer/entries/note.json")).unwrap())
                .unwrap();
        assert!(!detail.views.is_empty());
        for view in &detail.views {
            let CatalogueUsage::Ready { ranges, .. } = &view.usage else {
                panic!("plaintext usage must remain ready")
            };
            assert_eq!(ranges.len(), 1);
            assert_eq!(ranges[0].id, "r-0");
            assert_eq!(ranges[0].target, ComponentRangeTarget::Root);
            assert!(ranges[0].parent_id.is_none());
        }
        let html =
            fs::read_to_string(site.join("static/mokly-generated/note/index.mobile.html")).unwrap();
        assert!(
            html.contains("<plaintext>Note & &amp; <b>literal</b>"),
            "{html}"
        );
        assert!(!html.contains("mokly-normalize"), "{html}");
    }
}
