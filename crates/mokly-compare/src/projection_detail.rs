//! Shared comparison evidence for current and historical details.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::public_detail::EntryDetailV3;
use mokly_model::review::{ReviewEntry, ReviewEntryAddress, ReviewKind};
use mokly_model::review_order;

use crate::comparison_types::ComparisonResult;

/// Copy included reasons, view states, ignore ids, evidence, and a current entry's base address.
pub fn apply_evidence(details: &mut BTreeMap<String, EntryDetailV3>, result: &ComparisonResult) {
    let bases = base_addresses(&result.review.entries);
    for entry in &result.entries {
        let Some(detail) = details
            .get_mut(&entry.path)
            .filter(|detail| detail.entry.kind == entry.kind)
        else {
            continue;
        };
        detail.reasons = entry.included.then(|| {
            let mut reasons = entry.reasons.clone();
            review_order::normalize_reasons(&mut reasons);
            reasons
        });
        if detail.generation.is_none() {
            detail.before = bases.get(&(entry.kind, entry.path.as_str())).cloned();
        }
        for document in &entry.documents {
            if let Some(view) = detail.views.iter_mut().find(|view| {
                Some(view.viewport) == document.key.viewport
                    && view.color_scheme == document.key.color_scheme
            }) {
                view.state = Some(document.state);
                view.ignored_ids = Some(document.ignored_ids.clone());
                view.resource_evidence = Some(document.evidence.clone());
            }
            if entry.kind == EntryKind::Page {
                detail.resource_evidence = Some(document.evidence.clone());
            }
        }
    }
}

/// Base sides of current screens, components, and variants, keyed by kind and current path.
fn base_addresses(entries: &[ReviewEntry]) -> BTreeMap<(EntryKind, &str), ReviewEntryAddress> {
    entries
        .iter()
        .flat_map(|entry| std::iter::once(entry).chain(entry.variants.iter().flatten()))
        .filter(|entry| entry.after.is_some())
        .filter_map(|entry| {
            let kind = match entry.kind {
                ReviewKind::Screen => EntryKind::Screen,
                ReviewKind::Component => EntryKind::Component,
                ReviewKind::UseCase => return None,
            };
            entry
                .before
                .clone()
                .map(|before| ((kind, entry.path.as_str()), before))
        })
        .collect()
}
