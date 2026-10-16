//! Removed variants use their resolved surviving parent's position and base sibling order.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::CatalogueModel;
use mokly_model::snapshot::RemovedEntrySnapshot;

use crate::move_types::Pairing;

pub(crate) fn sort(
    removed: Vec<RemovedEntrySnapshot>,
    before: &CatalogueModel,
    after: &CatalogueModel,
    pairing: &Pairing,
    selected: &BTreeSet<usize>,
) -> Vec<RemovedEntrySnapshot> {
    let indices: BTreeMap<_, _> = before
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.metadata.path.as_str(), index))
        .collect();
    let destinations: BTreeMap<_, _> = pairing
        .entries
        .iter()
        .filter_map(|pair| Some((pair.before?, pair.after?)))
        .collect();
    let mut keyed = Vec::new();
    for record in removed {
        let path = &record.entry.metadata().path;
        let key = if let Some(index) = indices.get(path.as_str()) {
            let entry = &before.entries[*index];
            let parent = entry
                .metadata
                .variant_of
                .as_deref()
                .and_then(|path| indices.get(path))
                .copied();
            let anchor = parent
                .and_then(|parent| destinations.get(&parent))
                .and_then(|index| after.entries.get(*index))
                .filter(|parent| {
                    parent.metadata.variant_of.is_none()
                        && parent.content.kind() == entry.content.kind()
                })
                .map(|parent| parent.metadata.path.clone())
                .or_else(|| {
                    parent
                        .filter(|parent| selected.contains(parent))
                        .map(|index| before.entries[index].metadata.path.clone())
                });
            (
                entry.content.kind(),
                anchor.unwrap_or_else(|| path.clone()),
                usize::from(parent.is_some()),
                *index,
            )
        } else {
            (record.entry.kind(), path.clone(), 0, 0)
        };
        keyed.push((key, record));
    }
    keyed.sort_by(|(left, _), (right, _)| {
        left.0
            .cmp(&right.0)
            .then_with(|| compare_utf16(&left.1, &right.1))
            .then_with(|| left.2.cmp(&right.2))
            .then_with(|| left.3.cmp(&right.3))
    });
    keyed.into_iter().map(|(_, record)| record).collect()
}
