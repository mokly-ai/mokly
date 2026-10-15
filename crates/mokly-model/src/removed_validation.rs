//! Historical metadata, snapshot identities, and generation URL structure.

use std::collections::BTreeSet;

use crate::public_index::CatalogueReadModel;
use crate::public_metadata::{CatalogueChanges, ChangeKind};
use crate::public_records::CatalogueRecord;
use crate::public_validation::{hash, invalid, metadata, visual};
use crate::read_contract::ContractViolation;
use crate::readers::ReadError;

pub(crate) fn validate(index: &CatalogueReadModel) -> Result<(), ReadError> {
    if index.comparison_url.as_deref().is_some_and(|url| {
        !url.strip_prefix("mokly-viewer/diffs/generations/")
            .and_then(|tail| tail.strip_suffix("/review.json"))
            .is_some_and(hash)
    }) {
        return Err(invalid(ContractViolation::ComparisonUrl));
    }
    let mut paths = BTreeSet::new();
    let mut snapshots = BTreeSet::new();
    for removed in &index.removed_entries {
        let (entry, parent) = match &removed.entry {
            CatalogueRecord::Screen(record) => {
                visual(&record.visual)?;
                (&record.entry, record.variant_of.as_deref())
            }
            CatalogueRecord::Component(record) => {
                visual(&record.visual)?;
                (&record.entry, record.variant_of.as_deref())
            }
            CatalogueRecord::Page(record) => (&record.entry, None),
            CatalogueRecord::Document(record) => (&record.entry, None),
            CatalogueRecord::UseCase(record) => (&record.entry, None),
        };
        metadata(entry)?;
        if !matches!(
            entry.changes,
            CatalogueChanges::Ready {
                kind: ChangeKind::Removed,
                ..
            }
        ) {
            return Err(invalid(ContractViolation::RemovedChanges));
        }
        if entry.previous_path.is_some() {
            return Err(invalid(ContractViolation::RemovedPreviousPath));
        }
        if !paths.insert(entry.path.to_ascii_lowercase()) {
            return Err(invalid(ContractViolation::DuplicateRemovedPath));
        }
        if parent.is_some() != removed.parent_title.is_some()
            || removed
                .parent_title
                .as_ref()
                .is_some_and(|title| title.trim().is_empty())
        {
            return Err(invalid(ContractViolation::RemovedParentTitle));
        }
        if let Some(parent) = parent
            && !entry
                .path
                .strip_prefix(parent)
                .and_then(|suffix| suffix.strip_prefix('/'))
                .is_some_and(|slug| !slug.is_empty() && !slug.contains('/'))
        {
            return Err(invalid(ContractViolation::RemovedVariant));
        }
        if let Some(snapshot) = &removed.snapshot_id {
            if !hash(snapshot) || !snapshots.insert(snapshot) {
                return Err(invalid(ContractViolation::Snapshot));
            }
        } else if index.comparison_url.is_some() {
            return Err(invalid(ContractViolation::MissingSnapshot));
        }
    }
    Ok(())
}
