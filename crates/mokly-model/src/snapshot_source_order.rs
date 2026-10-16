//! Complete removed ordering uses accepted catalogue identities and base authored indices.

use std::collections::{BTreeMap, BTreeSet};

use crate::axes::EntryKind;
use crate::canonical::compare_utf16;
use crate::catalogue::CatalogueModel;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::snapshot::CatalogueChangeSnapshotV4;
use crate::snapshot_order;

pub(crate) fn validate(
    snapshot: &CatalogueChangeSnapshotV4,
    before: &CatalogueModel,
    after: &CatalogueModel,
) -> Result<(), ReadError> {
    let invalid = || ReadError::Contract {
        boundary: "change snapshot source order",
        message: ContractViolation::Snapshot,
    };
    let base: BTreeMap<_, _> = before
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            (
                (
                    entry.content.kind(),
                    entry.metadata.path.to_ascii_lowercase(),
                ),
                (index, entry),
            )
        })
        .collect();
    let current: BTreeMap<_, _> = after
        .entries
        .iter()
        .map(|entry| {
            (
                (
                    entry.content.kind(),
                    entry.metadata.path.to_ascii_lowercase(),
                ),
                entry,
            )
        })
        .collect();
    let moves: BTreeMap<_, _> = snapshot
        .moved_entries
        .iter()
        .map(|pair| (pair.previous_path.to_ascii_lowercase(), &pair.path))
        .collect();
    let selected: BTreeSet<_> = snapshot
        .removed_entries
        .iter()
        .map(|record| {
            (
                record.entry.kind(),
                record.entry.metadata().path.to_ascii_lowercase(),
            )
        })
        .collect();
    let mut previous = None;
    for record in &snapshot.removed_entries {
        let kind = record.entry.kind();
        let path = &record.entry.metadata().path;
        let Some((index, entry)) = base.get(&(kind, path.to_ascii_lowercase())) else {
            return Err(invalid());
        };
        if entry.metadata.variant_of.as_deref() != snapshot_order::parent(&record.entry) {
            return Err(invalid());
        }
        let parent = entry
            .metadata
            .variant_of
            .as_ref()
            .and_then(|path| base.get(&(kind, path.to_ascii_lowercase())));
        let anchor = parent
            .and_then(|(_, parent)| {
                let path = &parent.metadata.path;
                let target = moves
                    .get(&path.to_ascii_lowercase())
                    .copied()
                    .unwrap_or(path);
                current
                    .get(&(kind, target.to_ascii_lowercase()))
                    .filter(|parent| parent.metadata.variant_of.is_none())
                    .map(|parent| parent.metadata.path.clone())
                    .or_else(|| {
                        selected
                            .contains(&(kind, path.to_ascii_lowercase()))
                            .then(|| path.clone())
                    })
            })
            .unwrap_or_else(|| path.clone());
        let key = (kind, anchor, usize::from(parent.is_some()), *index);
        if previous
            .as_ref()
            .is_some_and(|old: &(EntryKind, String, usize, usize)| {
                old.0
                    .cmp(&key.0)
                    .then_with(|| compare_utf16(&old.1, &key.1))
                    .then_with(|| old.2.cmp(&key.2))
                    .then_with(|| old.3.cmp(&key.3))
                    .is_gt()
            })
        {
            return Err(invalid());
        }
        previous = Some(key);
    }
    Ok(())
}
