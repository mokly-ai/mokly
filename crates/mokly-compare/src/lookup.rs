//! Pure kind-aware branch-point lookup borrowed from one comparison generation.

use std::collections::BTreeMap;

use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{CatalogueModel, ModelEntry};
use mokly_model::review_affected::ReviewSide;
use mokly_model::snapshot::RemovedEntrySnapshot;
use mokly_model::snapshot_records::EntryRecord;

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

type Key = (EntryKind, String);

/// Indexed immutable lookup inputs borrowed from one generation.
pub struct Lookup<'a> {
    current: BTreeMap<Key, &'a ModelEntry>,
    base: BTreeMap<Key, &'a ModelEntry>,
    removed: BTreeMap<Key, &'a RemovedEntrySnapshot>,
    previous: BTreeMap<Key, &'a MovePair>,
    moved: BTreeMap<Key, &'a MovePair>,
}

impl<'a> Lookup<'a> {
    /// Index the accepted pairs and selected removals of one comparison.
    pub fn new(
        current: &'a CatalogueModel,
        base: Option<&'a CatalogueModel>,
        removed: &'a [RemovedEntrySnapshot],
        moves: &'a [MovePair],
    ) -> Self {
        let current = entries(current);
        let mut previous = BTreeMap::new();
        let mut moved = BTreeMap::new();
        for pair in moves {
            previous
                .entry(key(pair.kind, &pair.previous_path))
                .or_insert(pair);
            moved.entry(key(pair.kind, &pair.path)).or_insert(pair);
        }
        let mut removals = BTreeMap::new();
        for record in removed {
            removals
                .entry(key(record.entry.kind(), &record.entry.metadata().path))
                .or_insert(record);
        }
        Self {
            current,
            base: base.map(entries).unwrap_or_default(),
            removed: removals,
            previous,
            moved,
        }
    }

    /// Read original side metadata without following moves or removals.
    pub fn entry(&self, side: ReviewSide, kind: EntryKind, path: &str) -> Option<&'a ModelEntry> {
        let entries = match side {
            ReviewSide::Before => &self.base,
            ReviewSide::After => &self.current,
        };
        entries.get(&key(kind, path)).copied()
    }

    /// Resolve before references through accepted pairs, current identities, then removals.
    pub fn reference(
        &self,
        side: ReviewSide,
        kind: EntryKind,
        path: &str,
    ) -> Option<Destination<'a>> {
        let identity = key(kind, path);
        if side == ReviewSide::Before
            && let Some(pair) = self.previous.get(&identity)
        {
            return self.current(kind, &pair.path).map(Destination::Current);
        }
        if let Some(entry) = self.current.get(&identity) {
            return Some(Destination::Current(entry));
        }
        if side == ReviewSide::After {
            return None;
        }
        self.removed
            .get(&identity)
            .copied()
            .map(Destination::Removed)
    }

    /// Prove a current entry's original base spelling, without guessing from the current path.
    pub fn counterpart(&self, kind: EntryKind, path: &str) -> Option<&'a str> {
        let identity = key(kind, path);
        if !self.current.contains_key(&identity) {
            return None;
        }
        if let Some(pair) = self.moved.get(&identity) {
            return Some(&pair.previous_path);
        }
        self.base
            .get(&identity)
            .map(|entry| entry.metadata.path.as_str())
    }

    /// A previous path exists exactly on an accepted move, never on a case-only rename.
    pub fn previous(&self, kind: EntryKind, path: &str) -> Option<&'a str> {
        self.moved
            .get(&key(kind, path))
            .map(|pair| pair.previous_path.as_str())
    }

    /// Resolve a variant's parent with explicit reference side and role checks.
    pub fn parent(&self, variant: Destination<'a>) -> Option<Parent<'a>> {
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
        let parent = parent?;
        let resolved = self.reference(side, kind, parent);
        let eligible = resolved.filter(|destination| match destination {
            Destination::Current(entry) => entry.metadata.variant_of.is_none(),
            Destination::Removed(record) => record_parent(&record.entry).is_none(),
        });
        eligible
            .map(Parent::Entry)
            .or_else(|| title.map(Parent::Title))
    }

    fn current(&self, kind: EntryKind, path: &str) -> Option<&'a ModelEntry> {
        self.current.get(&key(kind, path)).copied()
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

fn entries(model: &CatalogueModel) -> BTreeMap<Key, &ModelEntry> {
    let mut entries = BTreeMap::new();
    for entry in &model.entries {
        entries
            .entry(key(entry.content.kind(), &entry.metadata.path))
            .or_insert(entry);
    }
    entries
}

fn key(kind: EntryKind, path: &str) -> Key {
    (kind, path.to_ascii_lowercase())
}
