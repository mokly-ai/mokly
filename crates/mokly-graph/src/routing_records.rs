//! Immutable route lookup and shared conservative identity for one catalogue.

use std::collections::{BTreeMap, BTreeSet};
use std::iter;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_model::catalogue::{EntryContent, ModelEntry};
use serde_json::json;

use crate::error::Result;
use crate::key::{NodeKey, NodeKind, data_key};

/// Indexed routing inputs and their complete conservative key for one generation.
pub(crate) struct RoutingRecords<'a> {
    entries: BTreeMap<String, &'a ModelEntry>,
    paths: BTreeSet<String>,
    complete: NodeKey,
}

impl<'a> RoutingRecords<'a> {
    /// Preserve catalogue order when a current path and an old alias overlap.
    pub(crate) fn new(catalogue: &'a PreparedCatalogue) -> Result<Self> {
        let mut entries = BTreeMap::new();
        let mut paths = BTreeSet::new();
        for entry in &catalogue.model.entries {
            paths.insert(entry.metadata.path.clone());
            for path in iter::once(&entry.metadata.path).chain(&entry.metadata.moved_from) {
                entries.entry(path.to_ascii_lowercase()).or_insert(entry);
            }
        }
        let complete = records_key(paths.clone(), &entries)?;
        Ok(Self {
            entries,
            paths,
            complete,
        })
    }

    /// Reuse only exact inventory subsets; other spellings retain their requested identity.
    pub(crate) fn key(&self, mut targets: BTreeSet<String>, opaque: bool) -> Result<NodeKey> {
        if opaque {
            if targets.is_subset(&self.paths) {
                return Ok(self.complete.clone());
            }
            targets.extend(self.paths.iter().cloned());
        }
        records_key(targets, &self.entries)
    }
}

#[tracing::instrument(name = "graph.prepare.routing-records", skip_all, err)]
fn records_key(
    mut targets: BTreeSet<String>,
    entries: &BTreeMap<String, &ModelEntry>,
) -> Result<NodeKey> {
    let mut records = Vec::new();
    let mut visited = BTreeSet::new();
    while let Some(path) = targets.pop_first() {
        let folded = path.to_ascii_lowercase();
        if !visited.insert(folded.clone()) {
            continue;
        }
        let Some(entry) = entries.get(&folded) else {
            records.push(json!({"missing":path}));
            continue;
        };
        let (schemes, first) = match &entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                (visual.color_schemes.clone(), None)
            }
            EntryContent::Document { color_schemes, .. } => (color_schemes.clone(), None),
            EntryContent::UseCase { steps } => {
                (Vec::new(), steps.first().map(|step| &step.screen_path))
            }
            EntryContent::Page => (Vec::new(), None),
        };
        if let Some(first) = first {
            targets.insert(first.clone());
        }
        records.push(json!({"requested":path,"path":entry.metadata.path,"kind":entry.content.kind(),"schemes":schemes,"first":first}));
    }
    data_key(NodeKind::Document, json!(records))
}
