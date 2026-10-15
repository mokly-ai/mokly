//! Review v8 projection keeps original side addresses and authored component groups.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::review::{ReviewEntry, ReviewKind, ReviewView};

use crate::comparison_types::EntryClassification;
use crate::comparison_views::address;
use crate::move_types::Pairing;

pub(crate) fn entries(
    classifications: &[EntryClassification],
    pairing: &Pairing,
    before: &CatalogueModel,
    after: &CatalogueModel,
) -> Vec<ReviewEntry> {
    let mut records = Vec::new();
    let mut parents = BTreeMap::new();
    let mut variants = Vec::new();
    for (classification, pair) in classifications.iter().zip(&pairing.entries) {
        let kind = match classification.kind {
            EntryKind::Screen => ReviewKind::Screen,
            EntryKind::Component => ReviewKind::Component,
            EntryKind::UseCase => ReviewKind::UseCase,
            _ => continue,
        };
        let previous = pair.before.map(|index| &before.entries[index]);
        let current = pair.after.map(|index| &after.entries[index]);
        let Some(entry) = current.or(previous) else {
            continue;
        };
        let parent = (kind == ReviewKind::Component)
            .then_some(entry.metadata.variant_of.as_ref())
            .flatten();
        let record = ReviewEntry {
            kind,
            path: classification.path.clone(),
            title: entry.metadata.title.clone(),
            before: previous.map(address),
            after: current.map(address),
            previous_path: classification.previous_path.clone(),
            state: classification.state,
            included: classification.included,
            reasons: classification.reasons.clone(),
            views: classification
                .documents
                .iter()
                .filter_map(|document| {
                    Some(ReviewView {
                        viewport: document.key.viewport?,
                        color_scheme: document.key.color_scheme,
                        state: document.state,
                        ignored_ids: document.ignored_ids.clone(),
                        rules: document.evidence.rules.clone(),
                        resources: document.evidence.resources.clone(),
                    })
                })
                .collect(),
            variants: (kind == ReviewKind::Component && parent.is_none()).then(Vec::new),
        };
        if let Some(parent) = parent {
            variants.push((parent.clone(), record));
        } else {
            if kind == ReviewKind::Component {
                parents.insert(
                    (current.is_some(), entry.metadata.path.to_ascii_lowercase()),
                    records.len(),
                );
            }
            records.push(record);
        }
    }
    let paths = pairing.paths(before, after);
    for (parent, variant) in variants {
        let current = variant.after.is_some();
        let mapped = paths.get(&parent.to_ascii_lowercase()).unwrap_or(&parent);
        let index = parents
            .get(&(current, parent.to_ascii_lowercase()))
            .or_else(|| parents.get(&(true, mapped.to_ascii_lowercase())))
            .or_else(|| parents.get(&(false, parent.to_ascii_lowercase())));
        if let Some(index) = index
            && let Some(children) = &mut records[*index].variants
        {
            children.push(variant);
        } else {
            records.push(variant);
        }
    }
    let current_order: BTreeMap<_, _> = after
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.metadata.path.as_str(), index))
        .collect();
    let base_order: BTreeMap<_, _> = before
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.metadata.path.as_str(), index))
        .collect();
    for record in &mut records {
        if let Some(variants) = &mut record.variants {
            variants.sort_by_key(|variant| {
                if variant.after.is_some() {
                    (
                        false,
                        current_order
                            .get(variant.path.as_str())
                            .copied()
                            .unwrap_or(usize::MAX),
                    )
                } else {
                    (
                        true,
                        base_order
                            .get(variant.path.as_str())
                            .copied()
                            .unwrap_or(usize::MAX),
                    )
                }
            });
        }
    }
    records
}
