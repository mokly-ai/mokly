//! Resolve affected Usage destinations from their actual side and entry context.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{CatalogueModel, EntryMetadata};
use mokly_model::review_affected::{
    AffectedConsumer, AffectedUsageEvidence, ConsumerKind, ReviewSide,
};

use crate::comparison_types::ComparisonResult;

type Key = (EntryKind, String);

/// One current or retained historical destination.
#[derive(Clone, Copy)]
pub(crate) struct LinkTarget<'a> {
    /// The destination's actual spelling and authored title.
    pub(crate) metadata: &'a EntryMetadata,
    /// Whether navigation must retain the historical snapshot identity.
    pub(crate) removed: bool,
}

/// Ownership belongs to the evidence side even when its destination moved.
#[derive(Clone, Copy)]
struct ResolvedReference<'a> {
    source: &'a EntryMetadata,
    destination: LinkTarget<'a>,
}

/// Side-specific reference indexes for one borrowed comparison generation.
pub(crate) struct References<'a> {
    current: BTreeMap<Key, ResolvedReference<'a>>,
    paired: BTreeMap<Key, ResolvedReference<'a>>,
    removed: BTreeMap<Key, ResolvedReference<'a>>,
}

impl<'a> References<'a> {
    /// Index accepted pairs, current identities, and only the retained removals.
    pub(crate) fn new(result: &'a ComparisonResult) -> Self {
        let before = &result.before.catalogue().model;
        let after = &result.after.catalogue().model;
        let base = entries(before);
        let current = entries(after);
        let paired = result
            .pairing
            .entries
            .iter()
            .filter_map(|pair| {
                let left = before.entries.get(pair.before?)?;
                let right = after.entries.get(pair.after?)?;
                Some((
                    key(left.content.kind(), &left.metadata.path),
                    ResolvedReference {
                        source: &left.metadata,
                        destination: LinkTarget {
                            metadata: &right.metadata,
                            removed: false,
                        },
                    },
                ))
            })
            .collect();
        let removed = result
            .snapshot
            .removed_entries
            .iter()
            .filter_map(|record| {
                let key = key(record.entry.kind(), &record.entry.metadata().path);
                let mut target = *base.get(&key)?;
                target.destination.removed = true;
                Some((key, target))
            })
            .collect();
        Self {
            current,
            paired,
            removed,
        }
    }

    /// Keep canonical impact grouping, but link an owning variant to its own entry.
    pub(crate) fn affected(
        &self,
        effect: &AffectedConsumer,
        evidence: &AffectedUsageEvidence,
    ) -> Option<LinkTarget<'a>> {
        let kind = match effect.consumer.kind {
            ConsumerKind::Screen => EntryKind::Screen,
            ConsumerKind::Component => EntryKind::Component,
        };
        let consumer = self.reference(ReviewSide::Before, kind, &effect.consumer.path)?;
        if kind != EntryKind::Component || evidence.context.kind != ConsumerKind::Component {
            return Some(consumer.destination);
        }
        let entry = self.reference(evidence.side, kind, &evidence.context.entry.path)?;
        let owner = match &entry.source.variant_of {
            None => Some(entry),
            Some(parent) => self
                .reference(evidence.side, kind, parent)
                .filter(|parent| parent.source.variant_of.is_none()),
        };
        if owner.is_some_and(|owner| {
            owner
                .destination
                .metadata
                .path
                .eq_ignore_ascii_case(&consumer.destination.metadata.path)
        }) {
            Some(entry.destination)
        } else {
            Some(consumer.destination)
        }
    }

    /// Before references prefer accepted pairs, then current identities and removals.
    fn reference(
        &self,
        side: ReviewSide,
        kind: EntryKind,
        path: &str,
    ) -> Option<ResolvedReference<'a>> {
        let key = key(kind, path);
        match side {
            ReviewSide::After => self.current.get(&key),
            ReviewSide::Before => self
                .paired
                .get(&key)
                .or_else(|| self.current.get(&key))
                .or_else(|| self.removed.get(&key)),
        }
        .copied()
    }
}

fn entries(model: &CatalogueModel) -> BTreeMap<Key, ResolvedReference<'_>> {
    model
        .entries
        .iter()
        .map(|entry| {
            (
                key(entry.content.kind(), &entry.metadata.path),
                ResolvedReference {
                    source: &entry.metadata,
                    destination: LinkTarget {
                        metadata: &entry.metadata,
                        removed: false,
                    },
                },
            )
        })
        .collect()
}

fn key(kind: EntryKind, path: &str) -> Key {
    (kind, path.to_ascii_lowercase())
}
