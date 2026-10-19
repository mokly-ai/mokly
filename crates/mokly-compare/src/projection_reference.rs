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

/// Original ownership metadata paired with its navigable destination.
struct ResolvedReference<'a> {
    original: &'a EntryMetadata,
    destination: LinkTarget<'a>,
}

/// Side-specific reference indexes for one borrowed comparison generation.
pub(crate) struct References<'a> {
    before: BTreeMap<Key, LinkTarget<'a>>,
    current: BTreeMap<Key, LinkTarget<'a>>,
    paired: BTreeMap<Key, LinkTarget<'a>>,
    removed: BTreeMap<Key, LinkTarget<'a>>,
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
                    LinkTarget {
                        metadata: &right.metadata,
                        removed: false,
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
                target.removed = true;
                Some((key, target))
            })
            .collect();
        Self {
            before: base,
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
        let consumer = self.destination(ReviewSide::Before, kind, &effect.consumer.path)?;
        if kind != EntryKind::Component || evidence.context.kind != ConsumerKind::Component {
            return Some(consumer);
        }
        let entry = self.reference(evidence.side, kind, &evidence.context.entry.path)?;
        let owner = match &entry.original.variant_of {
            None => Some(entry.destination),
            Some(parent) => self
                .destination(evidence.side, kind, parent)
                .filter(|parent| parent.metadata.variant_of.is_none()),
        };
        if owner.is_some_and(|owner| {
            owner
                .metadata
                .path
                .eq_ignore_ascii_case(&consumer.metadata.path)
        }) {
            Some(entry.destination)
        } else {
            Some(consumer)
        }
    }

    /// Keep the evidence-side entry separate from its current or historical destination.
    fn reference(
        &self,
        side: ReviewSide,
        kind: EntryKind,
        path: &str,
    ) -> Option<ResolvedReference<'a>> {
        let originals = match side {
            ReviewSide::Before => &self.before,
            ReviewSide::After => &self.current,
        };
        Some(ResolvedReference {
            original: originals.get(&key(kind, path))?.metadata,
            destination: self.destination(side, kind, path)?,
        })
    }

    /// Before references prefer accepted pairs, then current identities and removals.
    fn destination(&self, side: ReviewSide, kind: EntryKind, path: &str) -> Option<LinkTarget<'a>> {
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

fn entries(model: &CatalogueModel) -> BTreeMap<Key, LinkTarget<'_>> {
    model
        .entries
        .iter()
        .map(|entry| {
            (
                key(entry.content.kind(), &entry.metadata.path),
                LinkTarget {
                    metadata: &entry.metadata,
                    removed: false,
                },
            )
        })
        .collect()
}

fn key(kind: EntryKind, path: &str) -> Key {
    (kind, path.to_ascii_lowercase())
}
