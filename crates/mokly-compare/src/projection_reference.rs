//! Resolve affected Usage destinations from their actual side and entry context.

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::EntryMetadata;
use mokly_model::review_affected::{
    AffectedConsumer, AffectedUsageEvidence, ConsumerKind, ReviewSide,
};

use crate::comparison_types::ComparisonResult;
use crate::lookup::{Destination, Lookup};

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
    lookup: Lookup<'a>,
}

impl<'a> References<'a> {
    /// Borrow the one branch-point lookup for this projection batch.
    pub(crate) fn new(result: &'a ComparisonResult) -> Self {
        let lookup = Lookup::new(
            &result.after.catalogue().model,
            Some(&result.before.catalogue().model),
            &result.snapshot.removed_entries,
            &result.pairing.moves,
        );
        Self { lookup }
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
        let entry = self.lookup.entry(side, kind, path)?;
        self.destination(side, kind, path)
            .map(|destination| ResolvedReference {
                original: &entry.metadata,
                destination,
            })
    }

    fn destination(&self, side: ReviewSide, kind: EntryKind, path: &str) -> Option<LinkTarget<'a>> {
        let destination = self.lookup.reference(side, kind, path);
        match destination {
            Some(Destination::Current(entry)) => Some(LinkTarget {
                metadata: &entry.metadata,
                removed: false,
            }),
            Some(Destination::Removed(record)) => self
                .lookup
                .entry(ReviewSide::Before, kind, &record.entry.metadata().path)
                .map(|entry| LinkTarget {
                    metadata: &entry.metadata,
                    removed: true,
                }),
            None => None,
        }
    }
}
