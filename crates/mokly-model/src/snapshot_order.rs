//! Snapshot-local order checks preserve authored variant order for source validation.

use std::collections::BTreeMap;

use crate::canonical::compare_utf16;
use crate::snapshot::CatalogueChangeSnapshotV4;
use crate::snapshot_records::EntryRecord;

pub(crate) fn valid(snapshot: &CatalogueChangeSnapshotV4) -> bool {
    let parents: BTreeMap<_, _> = snapshot
        .removed_entries
        .iter()
        .filter(|record| parent(&record.entry).is_none())
        .map(|record| {
            (
                (record.entry.kind(), record.entry.metadata().path.as_str()),
                (),
            )
        })
        .collect();
    let moves: BTreeMap<_, _> = snapshot
        .moved_entries
        .iter()
        .map(|pair| (pair.previous_path.as_str(), pair.path.as_str()))
        .collect();
    let mut previous_kind = None;
    let mut previous = None;
    for removed in &snapshot.removed_entries {
        let kind = removed.entry.kind();
        if previous_kind.is_some_and(|previous| previous > kind) {
            return false;
        }
        previous_kind = Some(kind);
        let path = removed.entry.metadata().path.as_str();
        let anchor = match parent(&removed.entry) {
            None => Some((path, 0)),
            Some(parent) if parents.contains_key(&(kind, parent)) => Some((parent, 1)),
            Some(parent) => moves.get(parent).map(|path| (*path, 1)),
        };
        let Some((anchor, rank)) = anchor else {
            continue;
        };
        let key = (kind, anchor, rank);
        if previous.is_some_and(|(old_kind, old_path, old_rank)| {
            kind < old_kind
                || (kind == old_kind
                    && (compare_utf16(anchor, old_path).is_lt()
                        || (anchor == old_path && rank < old_rank)))
        }) {
            return false;
        }
        previous = Some(key);
    }
    true
}

pub(crate) fn parent(entry: &EntryRecord) -> Option<&str> {
    match entry {
        EntryRecord::Screen { visual, .. } | EntryRecord::Component { visual, .. } => {
            visual.variant_of.as_deref()
        }
        _ => None,
    }
}
