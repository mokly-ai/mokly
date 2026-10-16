//! Snapshot v4 structural admission without guessing current catalogue context.

use std::collections::BTreeSet;

use crate::canonical::compare_utf16;
use crate::paths::is_entry_path;
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;
use crate::record_validation;
use crate::snapshot::CatalogueChangeSnapshotV4;
use crate::snapshot_order;
use crate::snapshot_records::EntryRecord;

pub(crate) fn validate(snapshot: &CatalogueChangeSnapshotV4) -> Result<(), ReadError> {
    let invalid = || ReadError::Contract {
        boundary: "change snapshot",
        message: ContractViolation::Snapshot,
    };
    if !snapshot_order::valid(snapshot)
        || !matches!(snapshot.base_commit.len(), 40 | 64)
        || !snapshot
            .base_commit
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
        || snapshot.base_ref.is_empty()
        || !snapshot
            .changed_entries
            .iter()
            .all(|path| is_entry_path(path))
        || !snapshot
            .changed_entries
            .windows(2)
            .all(|pair| compare_utf16(&pair[0], &pair[1]).is_lt())
    {
        return Err(invalid());
    }
    let changed: BTreeSet<_> = snapshot
        .changed_entries
        .iter()
        .map(String::as_str)
        .collect();
    let mut moves = BTreeSet::new();
    let mut historical = BTreeSet::new();
    let mut previous = None;
    for moved in &snapshot.moved_entries {
        if !is_entry_path(&moved.path)
            || !is_entry_path(&moved.previous_path)
            || moved.path.eq_ignore_ascii_case(&moved.previous_path)
            || !changed.contains(moved.path.as_str())
            || !moves.insert(moved.path.to_ascii_lowercase())
            || !historical.insert(moved.previous_path.to_ascii_lowercase())
            || previous.is_some_and(|path| !compare_utf16(path, &moved.path).is_lt())
        {
            return Err(invalid());
        }
        previous = Some(moved.path.as_str());
    }
    let mut paths = BTreeSet::new();
    let mut snapshots = BTreeSet::new();
    for removed in &snapshot.removed_entries {
        let metadata = removed.entry.metadata();
        let parent = match &removed.entry {
            EntryRecord::Screen { visual, .. } | EntryRecord::Component { visual, .. } => {
                visual.variant_of.as_deref()
            }
            _ => None,
        };
        if !record_validation::valid(&removed.entry)
            || !is_entry_path(&metadata.path)
            || metadata.title.trim().is_empty()
            || !changed.contains(metadata.path.as_str())
            || !paths.insert(metadata.path.to_ascii_lowercase())
            || historical.contains(&metadata.path.to_ascii_lowercase())
            || moves.contains(&metadata.path.to_ascii_lowercase())
            || (parent.is_some() != removed.parent_title.is_some())
            || removed
                .parent_title
                .as_ref()
                .is_some_and(|title| title.trim().is_empty())
            || removed.snapshot_id.len() != 64
            || !removed
                .snapshot_id
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
            || !snapshots.insert(&removed.snapshot_id)
        {
            return Err(invalid());
        }
    }
    Ok(())
}
