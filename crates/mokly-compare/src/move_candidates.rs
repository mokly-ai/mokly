//! Candidate state and deterministic pass admission, including parent-owned variants.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::axes::EntryKind;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::{CatalogueModel, ModelEntry};

use crate::move_types::{EntryPair, MovePair, Pairing};

pub(crate) struct Candidates<'a> {
    pub(crate) before: &'a CatalogueModel,
    pub(crate) after: &'a CatalogueModel,
    pub(crate) removed: BTreeSet<usize>,
    pub(crate) added: BTreeSet<usize>,
    pub(crate) blocked_before: BTreeSet<usize>,
    pub(crate) blocked_after: BTreeSet<usize>,
    pub(crate) result: Pairing,
}

impl<'a> Candidates<'a> {
    pub(crate) fn new(before: &'a CatalogueModel, after: &'a CatalogueModel) -> Self {
        let index: BTreeMap<_, _> = before
            .entries
            .iter()
            .enumerate()
            .map(|(index, entry)| {
                (
                    (
                        entry.content.kind(),
                        entry.metadata.path.to_ascii_lowercase(),
                    ),
                    index,
                )
            })
            .collect();
        let mut state = Self {
            before,
            after,
            removed: (0..before.entries.len()).collect(),
            added: BTreeSet::new(),
            blocked_before: BTreeSet::new(),
            blocked_after: BTreeSet::new(),
            result: Pairing::default(),
        };
        for (current, entry) in after.entries.iter().enumerate() {
            if let Some(previous) = index.get(&(
                entry.content.kind(),
                entry.metadata.path.to_ascii_lowercase(),
            )) {
                state.removed.remove(previous);
                state.result.entries.push(EntryPair {
                    before: Some(*previous),
                    after: Some(current),
                    moved: false,
                });
            } else {
                state.added.insert(current);
            }
        }
        state
    }

    pub(crate) fn accept(&mut self, previous: usize, current: usize) {
        if !self.removed.remove(&previous) || !self.added.remove(&current) {
            return;
        }
        let left = &self.before.entries[previous];
        let right = &self.after.entries[current];
        self.result.entries.push(EntryPair {
            before: Some(previous),
            after: Some(current),
            moved: true,
        });
        self.result.moves.push(MovePair {
            kind: right.content.kind(),
            path: right.metadata.path.clone(),
            previous_path: left.metadata.path.clone(),
        });
    }

    pub(crate) fn children(&mut self, declared: bool) {
        let parents: Vec<_> = self
            .result
            .entries
            .iter()
            .filter_map(|pair| {
                let left = self.before.entries.get(pair.before?)?;
                let right = self.after.entries.get(pair.after?)?;
                (left.metadata.variant_of.is_none() && right.metadata.variant_of.is_none())
                    .then_some((
                        left.metadata.path.clone(),
                        right.metadata.path.clone(),
                        right.content.kind(),
                    ))
            })
            .collect();
        for (previous, current, kind) in parents {
            let children: BTreeMap<_, _> = self
                .removed
                .iter()
                .filter_map(|index| {
                    let entry = &self.before.entries[*index];
                    (entry.content.kind() == kind
                        && entry.metadata.variant_of.as_deref() == Some(previous.as_str()))
                    .then(|| (slug(entry), *index))
                })
                .collect();
            let pairs: Vec<_> = self
                .added
                .iter()
                .filter_map(|index| {
                    let entry = &self.after.entries[*index];
                    if entry.content.kind() != kind
                        || entry.metadata.variant_of.as_deref() != Some(current.as_str())
                        || (declared && entry.metadata.moved_from.is_some())
                    {
                        return None;
                    }
                    Some((*children.get(&slug(entry))?, *index))
                })
                .collect();
            for (left, right) in pairs {
                self.accept(left, right);
            }
        }
    }

    pub(crate) fn admit(&mut self, edges: Vec<(usize, usize)>) -> usize {
        let mut by_removed: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
        let mut by_added: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
        for (left, right) in edges {
            by_removed.entry(left).or_default().push(right);
            by_added.entry(right).or_default().push(left);
        }
        for (index, matches) in &by_added {
            if matches.len() > 1 {
                self.blocked_after.insert(*index);
                self.result.diagnostics.push(ambiguous(
                    "added",
                    &self.after.entries[*index],
                    "removed",
                    matches
                        .iter()
                        .map(|index| self.before.entries[*index].metadata.path.clone())
                        .collect(),
                ));
            }
        }
        for (index, matches) in &by_removed {
            if matches.len() > 1 {
                self.blocked_before.insert(*index);
                self.result.diagnostics.push(ambiguous(
                    "removed",
                    &self.before.entries[*index],
                    "added",
                    matches
                        .iter()
                        .map(|index| self.after.entries[*index].metadata.path.clone())
                        .collect(),
                ));
            }
        }
        let mut accepted = 0;
        for (current, matches) in by_added {
            if matches.len() != 1 || self.blocked_after.contains(&current) {
                continue;
            }
            let previous = matches[0];
            if !self.blocked_before.contains(&previous)
                && by_removed
                    .get(&previous)
                    .is_some_and(|matches| matches.len() == 1)
            {
                self.accept(previous, current);
                accepted += 1;
            }
        }
        accepted
    }

    pub(crate) fn eligible(&self, left: usize, right: usize) -> bool {
        let before = &self.before.entries[left];
        let after = &self.after.entries[right];
        !self.blocked_before.contains(&left)
            && !self.blocked_after.contains(&right)
            && before.content.kind() == after.content.kind()
            && (before.content.kind() != EntryKind::Component
                || before.metadata.variant_of.is_some() == after.metadata.variant_of.is_some())
    }

    pub(crate) fn finish(mut self) -> Pairing {
        let current: BTreeSet<_> = self
            .after
            .entries
            .iter()
            .map(|entry| entry.metadata.path.to_ascii_lowercase())
            .collect();
        for index in self.removed {
            if !current.contains(
                &self.before.entries[index]
                    .metadata
                    .path
                    .to_ascii_lowercase(),
            ) {
                self.result.entries.push(EntryPair {
                    before: Some(index),
                    after: None,
                    moved: false,
                });
            }
        }
        for index in self.added {
            self.result.entries.push(EntryPair {
                before: None,
                after: Some(index),
                moved: false,
            });
        }
        self.result
            .moves
            .sort_by(|left, right| compare_utf16(&left.path, &right.path));
        self.result
    }
}

fn slug(entry: &ModelEntry) -> String {
    entry
        .metadata
        .path
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn ambiguous(side: &str, entry: &ModelEntry, other: &str, mut paths: Vec<String>) -> String {
    paths.sort_by(|left, right| compare_utf16(left, right));
    format!(
        "{side} {} {} matches {other} entries {}; declare movedFrom to pair it",
        entry.content.kind().as_str(),
        entry.metadata.path,
        paths.join(" and ")
    )
}
