//! Original paired spellings govern document sharing across the complete catalogue.

use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use serde_json::json;

use crate::move_types::{EntryPair, Pairing};

fn model(path: &str) -> CatalogueModel {
    CatalogueModel {
        entries: vec![ModelEntry {
            metadata: serde_json::from_value(json!({
                "path": path, "title": "Page", "description": "", "tags": [],
                "relatedDocs": [], "isIndex": false, "rootIndex": 0,
                "source": {"path": "page.page.html", "line": 1, "column": 1}
            }))
            .unwrap(),
            content: EntryContent::Page,
        }],
        folders: vec![],
        sources: vec![],
        color_schemes: vec![],
    }
}

#[test]
fn original_identity_pairs_admit_sharing_but_moves_and_case_only_renames_do_not() {
    let before = model("Card");
    for (path, moved, expected) in [
        ("Card", false, true),
        ("card", false, false),
        ("Moved", true, false),
    ] {
        let after = model(path);
        let pairing = Pairing {
            entries: vec![EntryPair {
                before: Some(0),
                after: Some(0),
                moved,
            }],
            ..Default::default()
        };
        assert_eq!(
            pairing.preserves_document_paths(&before, &after),
            expected,
            "original path Card to {path}"
        );
    }
}
