//! Pure kind-aware branch-point lookup fenced to one accepted generation.

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{CatalogueModel, ModelEntry};
use mokly_model::review_affected::ReviewSide;
use mokly_model::snapshot::RemovedEntrySnapshot;
use mokly_model::snapshot_records::EntryRecord;
use thiserror::Error;

use crate::move_types::MovePair;

/// A reference resolves to a current identity or its exact historical record.
#[derive(Clone, Copy, Debug)]
pub enum Destination<'a> {
    /// Current entry, with its current spelling and title.
    Current(&'a ModelEntry),
    /// Selected removed record, including snapshot id and historical titles.
    Removed(&'a RemovedEntrySnapshot),
}

/// Eligible variant parent, or the historical title without a fabricated destination.
#[derive(Clone, Copy, Debug)]
pub enum Parent<'a> {
    /// A current or removed non-variant of the same kind.
    Entry(Destination<'a>),
    /// Stored base parent title when that identity has no eligible destination.
    Title(&'a str),
}

/// Invalid or stale accepted lookup context.
#[derive(Debug, Error)]
pub enum LookupError {
    /// A request attempts to use another generation's identity map.
    #[error("[mokly-compare/lookup] reference belongs to another generation")]
    Generation,
    /// Accepted pairs violate their existing-identity exclusion rule.
    #[error("[mokly-compare/lookup] accepted pair conflicts with a current identity")]
    PairInvariant,
}

/// Borrowed immutable lookup inputs for one generation.
pub struct Lookup<'a> {
    generation: &'a str,
    current: &'a CatalogueModel,
    base: Option<&'a CatalogueModel>,
    removed: &'a [RemovedEntrySnapshot],
    moves: &'a [MovePair],
}

impl<'a> Lookup<'a> {
    /// Validate the accepted-pair/current-path invariant once.
    pub fn new(
        generation: &'a str,
        current: &'a CatalogueModel,
        base: Option<&'a CatalogueModel>,
        removed: &'a [RemovedEntrySnapshot],
        moves: &'a [MovePair],
    ) -> Result<Self, LookupError> {
        for pair in moves {
            if current.entries.iter().any(|entry| {
                entry.content.kind() == pair.kind
                    && entry
                        .metadata
                        .path
                        .eq_ignore_ascii_case(&pair.previous_path)
            }) || pair.path.eq_ignore_ascii_case(&pair.previous_path)
            {
                return Err(LookupError::PairInvariant);
            }
        }
        Ok(Self {
            generation,
            current,
            base,
            removed,
            moves,
        })
    }

    /// Resolve before references through accepted pairs, current identities, then removals.
    pub fn reference(
        &self,
        generation: &str,
        side: ReviewSide,
        kind: EntryKind,
        path: &str,
    ) -> Result<Option<Destination<'a>>, LookupError> {
        self.fence(generation)?;
        if side == ReviewSide::Before
            && let Some(pair) = self
                .moves
                .iter()
                .find(|pair| pair.kind == kind && pair.previous_path.eq_ignore_ascii_case(path))
        {
            return Ok(self.current(kind, &pair.path).map(Destination::Current));
        }
        if let Some(entry) = self.current(kind, path) {
            return Ok(Some(Destination::Current(entry)));
        }
        if side == ReviewSide::After {
            return Ok(None);
        }
        Ok(self
            .removed
            .iter()
            .find(|record| {
                record.entry.kind() == kind
                    && record.entry.metadata().path.eq_ignore_ascii_case(path)
            })
            .map(Destination::Removed))
    }

    /// Prove a current entry's original base spelling, without guessing from the current path.
    pub fn counterpart(
        &self,
        generation: &str,
        kind: EntryKind,
        path: &str,
    ) -> Result<Option<&'a str>, LookupError> {
        self.fence(generation)?;
        if self.current(kind, path).is_none() {
            return Ok(None);
        }
        if let Some(previous) = self.previous(generation, kind, path)? {
            return Ok(Some(previous));
        }
        Ok(self
            .base
            .and_then(|base| {
                base.entries.iter().find(|entry| {
                    entry.content.kind() == kind && entry.metadata.path.eq_ignore_ascii_case(path)
                })
            })
            .map(|entry| entry.metadata.path.as_str()))
    }

    /// A previous path exists exactly on an accepted move, never on a case-only rename.
    pub fn previous(
        &self,
        generation: &str,
        kind: EntryKind,
        path: &str,
    ) -> Result<Option<&'a str>, LookupError> {
        self.fence(generation)?;
        Ok(self
            .moves
            .iter()
            .find(|pair| pair.kind == kind && pair.path.eq_ignore_ascii_case(path))
            .map(|pair| pair.previous_path.as_str()))
    }

    /// Resolve a variant's parent with explicit reference side and role checks.
    pub fn parent(
        &self,
        generation: &str,
        variant: Destination<'a>,
    ) -> Result<Option<Parent<'a>>, LookupError> {
        self.fence(generation)?;
        let (side, kind, parent, title) = match variant {
            Destination::Current(entry) => (
                ReviewSide::After,
                entry.content.kind(),
                entry.metadata.variant_of.as_deref(),
                None,
            ),
            Destination::Removed(record) => (
                ReviewSide::Before,
                record.entry.kind(),
                record_parent(&record.entry),
                record.parent_title.as_deref(),
            ),
        };
        let Some(parent) = parent else {
            return Ok(None);
        };
        let resolved = self.reference(generation, side, kind, parent)?;
        let eligible = resolved.filter(|destination| match destination {
            Destination::Current(entry) => entry.metadata.variant_of.is_none(),
            Destination::Removed(record) => record_parent(&record.entry).is_none(),
        });
        Ok(eligible
            .map(Parent::Entry)
            .or_else(|| title.map(Parent::Title)))
    }

    fn current(&self, kind: EntryKind, path: &str) -> Option<&'a ModelEntry> {
        self.current.entries.iter().find(|entry| {
            entry.content.kind() == kind && entry.metadata.path.eq_ignore_ascii_case(path)
        })
    }

    fn fence(&self, generation: &str) -> Result<(), LookupError> {
        if generation == self.generation {
            Ok(())
        } else {
            Err(LookupError::Generation)
        }
    }
}

fn record_parent(record: &EntryRecord) -> Option<&str> {
    match record {
        EntryRecord::Screen { visual, .. } | EntryRecord::Component { visual, .. } => {
            visual.variant_of.as_deref()
        }
        _ => None,
    }
}
