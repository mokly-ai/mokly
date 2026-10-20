//! Confirmed plaintext preserves an own-page root through repeated normalization.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::usage::{CatalogueUsage, ComponentRangeTarget};
use unimock::Unimock;

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::{normalization, serialize};

use super::support;

#[test]
fn own_plaintext_root_survives_repeated_repair_without_changing_text() {
    for body in [
        "<plaintext>Note & &amp; <b>literal</b>",
        "<main><p>Before</p><plaintext>Note & &amp; <b>literal</b>",
    ] {
        let catalogue = support::prepared_html("<p>Home</p>", body);
        let entry = catalogue
            .model
            .entries
            .iter()
            .find(|entry| entry.metadata.path == "note")
            .unwrap();
        let mut document = HtmlComposer {
            fragments: Arc::new(Unimock::new(())),
        }
        .compose(&ComposeRequest {
            catalogue: &catalogue,
            entry,
            viewport: Viewport::Mobile,
            color_scheme: ColorScheme::Light,
            stylesheets: Vec::new(),
        })
        .unwrap();
        let before = serialize::html(&document.tree);
        for _ in 0..2 {
            normalization::composed(&mut document, entry, &catalogue).unwrap();
            let CatalogueUsage::Ready { ranges, .. } = &document.usage else {
                panic!("expected ready usage")
            };
            assert_eq!(ranges.len(), 1);
            assert_eq!(ranges[0].target, ComponentRangeTarget::Root);
            assert_eq!(ranges[0].id, "r-0");
            assert!(ranges[0].parent_id.is_none());
            assert!(document.warnings.is_empty(), "{:?}", document.warnings);
            assert_eq!(serialize::html(&document.tree), before);
        }
    }
}
