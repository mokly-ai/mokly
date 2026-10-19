//! JSON-pointer source locations, stored as a flat tree of pointer segments.
//!
//! A map of complete pointer strings grows with the square of the nesting
//! depth. The segment tree stores each pointer segment once, so its memory is
//! linear in the number of nodes and no operation recurses.

use std::collections::BTreeMap;

use mokly_model::catalogue::SourceLocation;

/// Source locations by JSON pointer.
#[derive(Clone, Debug)]
pub(crate) struct Positions {
    /// Slot 0 is the document root, the empty pointer.
    slots: Vec<Slot>,
}

#[derive(Clone, Debug, Default)]
struct Slot {
    location: Option<SourceLocation>,
    /// Escaped pointer segment to child slot.
    children: BTreeMap<String, usize>,
}

/// The root slot, the empty JSON pointer.
pub(crate) const ROOT: usize = 0;

impl Default for Positions {
    fn default() -> Self {
        Self {
            slots: vec![Slot::default()],
        }
    }
}

impl Positions {
    /// A tree that records only its root location.
    pub(crate) fn at(location: SourceLocation) -> Self {
        let mut positions = Self::default();
        positions.set(ROOT, location);
        positions
    }

    /// The location recorded for an escaped JSON pointer.
    pub(crate) fn get(&self, pointer: &str) -> Option<&SourceLocation> {
        let mut slot = ROOT;
        if !pointer.is_empty() {
            for segment in pointer.strip_prefix('/')?.split('/') {
                slot = *self.slots[slot].children.get(segment)?;
            }
        }
        self.slots[slot].location.as_ref()
    }

    /// Record a location for an escaped JSON pointer, replacing an earlier one.
    /// A string that is not a JSON pointer records nothing.
    pub(crate) fn insert(&mut self, pointer: &str, location: SourceLocation) {
        let mut slot = ROOT;
        if !pointer.is_empty() {
            let Some(segments) = pointer.strip_prefix('/') else {
                return;
            };
            for segment in segments.split('/') {
                slot = self.child(slot, segment);
            }
        }
        self.set(slot, location);
    }

    /// The slot of the escaped `segment` below `parent`, created when missing.
    pub(crate) fn child(&mut self, parent: usize, segment: &str) -> usize {
        if let Some(slot) = self.slots[parent].children.get(segment) {
            return *slot;
        }
        let slot = self.slots.len();
        self.slots.push(Slot::default());
        self.slots[parent].children.insert(segment.to_owned(), slot);
        slot
    }

    /// Record the location of one slot.
    pub(crate) fn set(&mut self, slot: usize, location: SourceLocation) {
        self.slots[slot].location = Some(location);
    }

    /// Copy the locations at and below `slot` into a tree rooted at that slot.
    pub(crate) fn subtree(&self, slot: usize) -> Self {
        let mut copy = Self::default();
        copy.slots[ROOT].location = self.slots[slot].location.clone();
        copy.graft(ROOT, self, slot);
        copy
    }

    /// Copy the locations below `from` in `source` to below `slot` in this tree.
    pub(crate) fn graft(&mut self, slot: usize, source: &Self, from: usize) {
        let mut pending = vec![(from, slot)];
        while let Some((from, to)) = pending.pop() {
            for (segment, child) in &source.slots[from].children {
                let copied = self.child(to, segment);
                if let Some(location) = &source.slots[*child].location {
                    self.slots[copied].location = Some(location.clone());
                }
                pending.push((*child, copied));
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/yaml_positions_tests.rs"]
mod yaml_positions_tests;
