//! Shared comparison evidence for current and historical details.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::public_detail::EntryDetailV1;

use crate::comparison_types::ComparisonResult;

/// Copy classified resource evidence onto the matching entry and view axes.
pub fn apply_evidence(details: &mut BTreeMap<String, EntryDetailV1>, result: &ComparisonResult) {
    for entry in &result.entries {
        let Some(detail) = details
            .get_mut(&entry.path)
            .filter(|detail| detail.entry.kind == entry.kind)
        else {
            continue;
        };
        for document in &entry.documents {
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == document.key.viewport
                    && view.color_scheme == document.key.color_scheme
            }) {
                view.resource_evidence = Some(document.evidence.clone());
            }
            if entry.kind == EntryKind::Page {
                detail.resource_evidence = Some(document.evidence.clone());
            }
        }
    }
}
