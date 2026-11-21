//! Generation-owned compact facts and reverse invalidation in the current graph.

use std::collections::{BTreeMap, BTreeSet};
use std::mem::size_of;

use serde_json::to_vec;
use sha2::{Digest, Sha256};

use crate::render_closure::{Parts, Records};
use crate::render_preparation::Prepared;

#[derive(Clone, Debug)]
pub(crate) struct Facts {
    modules: Vec<(String, [u8; 32])>,
    stories: Vec<String>,
    shared: [u8; 32],
    renderer: [u8; 32],
    preview: [u8; 32],
}

impl Facts {
    pub(crate) fn new(
        prepared: &Prepared<'_>,
        renderer: &Parts<'_>,
        preview: &Parts<'_>,
    ) -> serde_json::Result<Self> {
        let records = &prepared.records;
        let modules = records
            .modules
            .iter()
            .map(|(path, record)| ((*path).to_owned(), module(records, path, record)))
            .collect();
        let stories = prepared
            .exporters
            .iter()
            .filter(|(_, story)| *story)
            .map(|(module, _)| (*module).to_owned())
            .collect();
        Ok(Self {
            modules,
            stories,
            shared: Sha256::digest(prepared.shared.as_bytes()).into(),
            renderer: common(prepared.renderer, renderer)?,
            preview: common(prepared.preview, preview)?,
        })
    }

    /// Removed edges change their current importer record, so no prior reverse graph is needed.
    pub(crate) fn affected<'a>(
        &'a self,
        previous: &Self,
        graph: &'a BTreeMap<String, Vec<String>>,
    ) -> BTreeSet<&'a str> {
        let mut before = previous.modules.iter().peekable();
        let mut pending = Vec::new();
        for (module, fact) in &self.modules {
            while before.peek().is_some_and(|(name, _)| name < module) {
                before.next();
            }
            if !before
                .peek()
                .is_some_and(|(name, value)| name == module && value == fact)
            {
                pending.push(module.as_str());
            }
        }
        if pending.is_empty() {
            return BTreeSet::new();
        }
        let mut reverse: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
        for (module, imports) in graph {
            for import in imports {
                reverse.entry(import).or_default().push(module);
            }
        }
        let mut affected = BTreeSet::new();
        while let Some(module) = pending.pop() {
            if affected.insert(module)
                && let Some(importers) = reverse.get(module)
            {
                pending.extend(importers);
            }
        }
        affected
    }

    pub(crate) fn same_common(&self, previous: &Self, story: bool) -> bool {
        self.shared == previous.shared
            && if story {
                self.preview == previous.preview
            } else {
                self.renderer == previous.renderer
            }
    }

    pub(crate) fn same_mode(&self, previous: &Self, module: &str) -> bool {
        self.stories
            .binary_search_by(|name| name.as_str().cmp(module))
            .is_ok()
            == previous
                .stories
                .binary_search_by(|name| name.as_str().cmp(module))
                .is_ok()
    }

    /// Owned allocation capacities, excluding allocator headers and the existing key map.
    pub(crate) fn bytes(&self) -> usize {
        size_of::<Self>()
            + self.modules.capacity() * size_of::<(String, [u8; 32])>()
            + self
                .modules
                .iter()
                .map(|(path, _)| path.capacity())
                .sum::<usize>()
            + self.stories.capacity() * size_of::<String>()
            + self.stories.iter().map(String::capacity).sum::<usize>()
    }
}

/// Hash precisely one module's encoded record, attributed bindings, and present chain records.
fn module(records: &Records<'_>, path: &str, record: &[u8]) -> [u8; 32] {
    let mut hash = Sha256::new();
    field(&mut hash, record);
    let bindings = records.bindings.get(path).map_or(&[][..], Vec::as_slice);
    hash.update((bindings.len() as u64).to_be_bytes());
    for binding in bindings {
        field(&mut hash, binding);
    }
    for name in records.chains.get(path).into_iter().flatten() {
        if let Some(record) = records.resolution.get(name.as_str()) {
            field(&mut hash, record);
        }
    }
    hash.finalize().into()
}

/// The selected root participates even when two roots reach the same unchanged records.
fn common(root: Option<&str>, parts: &Parts<'_>) -> serde_json::Result<[u8; 32]> {
    let empty = Parts::empty();
    let key = parts.key(&empty, "");
    Ok(Sha256::digest(to_vec(&(root, key.0))?).into())
}

fn field(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_be_bytes());
    hash.update(bytes);
}
