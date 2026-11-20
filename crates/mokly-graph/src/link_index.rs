//! Immutable entry positions locate ordered targets in the existing plan map.

use std::collections::BTreeMap;

use mokly_model::catalogue::ModelEntry;

use crate::types::DocumentPlan;

/// Complete generation metadata stores entry positions and first-view offsets.
pub(crate) struct LinkIndex {
    entries: Box<[usize]>,
    offsets: Box<[usize]>,
}

impl LinkIndex {
    /// Group existing plans once, preserving the plans' route order in each entry.
    pub(crate) fn new(plans: &BTreeMap<String, DocumentPlan>, entries: &[ModelEntry]) -> Self {
        let mut ordered: Vec<_> = (0..entries.len()).collect();
        ordered.sort_unstable_by(|left, right| {
            entries[*left]
                .metadata
                .path
                .cmp(&entries[*right].metadata.path)
                .then(left.cmp(right))
        });
        let mut offsets = vec![plans.len(); entries.len()];
        for (position, plan) in plans.values().enumerate() {
            if offsets[plan.entry] == plans.len() {
                offsets[plan.entry] = position;
            }
        }
        Self {
            entries: ordered.into_boxed_slice(),
            offsets: offsets.into_boxed_slice(),
        }
    }

    /// Find an entry without copying its path into the index.
    pub(crate) fn entry(&self, entries: &[ModelEntry], path: &str) -> Option<usize> {
        let position = self
            .entries
            .partition_point(|index| entries[*index].metadata.path.as_str() < path);
        self.entries
            .get(position)
            .copied()
            .filter(|index| entries[*index].metadata.path == path)
    }

    /// Borrow existing target plans in route order without scanning other entries.
    pub(crate) fn views<'a>(
        &self,
        plans: &'a BTreeMap<String, DocumentPlan>,
        entries: &'a [ModelEntry],
        entry: usize,
    ) -> impl Iterator<Item = (usize, &'a DocumentPlan)> + 'a {
        let offset = self.offsets[entry];
        let path = &entries[entry].metadata.path;
        let prefix = format!("{path}/index.");
        plans
            .range(prefix.clone()..)
            .take_while(move |(route, _)| route.starts_with(&prefix))
            .filter(move |(_, plan)| entries[plan.entry].metadata.path == *path)
            .enumerate()
            .map(move |(ordinal, (_, plan))| (offset + ordinal, plan))
    }
}
