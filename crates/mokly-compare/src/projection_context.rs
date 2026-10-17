//! Index shared identity and eligibility facts once per projection.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::EntryMetadata;
use mokly_model::public_metadata::ChangeKind;
use mokly_model::review::ReviewState;

use crate::comparison_types::{ComparisonResult, EntryClassification};

pub(crate) struct Context<'a> {
    pub(crate) metadata: BTreeMap<&'a str, &'a EntryMetadata>,
    pub(crate) classifications: BTreeMap<&'a str, &'a EntryClassification>,
    pub(crate) removed: BTreeSet<&'a str>,
    pub(crate) counterparts: BTreeMap<&'a str, &'a str>,
    paired: BTreeSet<&'a str>,
}

impl<'a> Context<'a> {
    pub(crate) fn new(result: &'a ComparisonResult) -> Self {
        let before = &result.before.catalogue().model;
        let current = &result.after.catalogue().model;
        let mut paired = BTreeSet::new();
        let mut counterparts = BTreeMap::new();
        for pair in &result.pairing.entries {
            let Some(left) = pair.before.and_then(|index| before.entries.get(index)) else {
                continue;
            };
            let Some(right) = pair.after.and_then(|index| current.entries.get(index)) else {
                continue;
            };
            paired.insert(right.metadata.path.as_str());
            if left.content.kind() == EntryKind::Component
                && right.content.kind() == EntryKind::Component
            {
                counterparts.insert(right.metadata.path.as_str(), left.metadata.path.as_str());
            }
        }
        Self {
            metadata: before
                .entries
                .iter()
                .chain(&current.entries)
                .map(|entry| (entry.metadata.path.as_str(), &entry.metadata))
                .collect(),
            classifications: result
                .entries
                .iter()
                .map(|entry| (entry.path.as_str(), entry))
                .collect(),
            removed: result
                .snapshot
                .removed_entries
                .iter()
                .map(|entry| entry.entry.metadata().path.as_str())
                .collect(),
            counterparts,
            paired,
        }
    }

    pub(crate) fn kind(&self, entry: &EntryClassification) -> ChangeKind {
        if entry.included
            && !entry.reasons.is_empty()
            && matches!(
                entry.state,
                ReviewState::Unchanged | ReviewState::IgnoredOnly
            )
        {
            ChangeKind::Changed
        } else {
            self.comparison_kind(entry)
        }
    }

    pub(crate) fn comparison_kind(&self, entry: &EntryClassification) -> ChangeKind {
        if (!self.removed.contains(entry.path.as_str()) && entry.state == ReviewState::Removed)
            || (self.paired.contains(entry.path.as_str()) && entry.state == ReviewState::Added)
        {
            ChangeKind::Changed
        } else {
            Self::view_kind(entry.state)
        }
    }

    pub(crate) fn eligible(&self, entry: &EntryClassification) -> bool {
        self.can_compare(&entry.path, entry.kind)
            && if entry.kind == EntryKind::Component {
                matches!(
                    self.comparison_kind(entry),
                    ChangeKind::Changed | ChangeKind::Removed
                )
            } else {
                entry
                    .documents
                    .iter()
                    .any(|view| view.state == ReviewState::Changed)
            }
    }

    pub(crate) fn can_compare(&self, path: &str, kind: EntryKind) -> bool {
        kind == EntryKind::Component || (kind == EntryKind::Screen && !self.removed.contains(path))
    }

    pub(crate) fn view_kind(state: ReviewState) -> ChangeKind {
        match state {
            ReviewState::Added => ChangeKind::Added,
            ReviewState::Removed => ChangeKind::Removed,
            ReviewState::Changed => ChangeKind::Changed,
            ReviewState::Unchanged | ReviewState::IgnoredOnly => ChangeKind::Unmodified,
        }
    }
}
