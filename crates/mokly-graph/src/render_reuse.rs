//! Generation-owned compact facts and reverse invalidation in the current graph.

use std::collections::{BTreeMap, BTreeSet};
use std::mem::size_of;

use serde_json::to_vec;
use sha2::{Digest, Sha256};

use crate::render_closure::{Parts, Records};
use crate::render_preparation::{Common, Prepared};

#[derive(Clone, Debug)]
pub(crate) struct Facts {
    modules: Vec<(String, [u8; 32])>,
    stories: Vec<(String, Option<String>)>,
    shared: [u8; 32],
    renderer: [u8; 32],
    previews: Vec<(String, [u8; 32])>,
}

impl Facts {
    pub(crate) fn new(
        prepared: &Prepared<'_>,
        renderer: &Parts<'_>,
        previews: &BTreeMap<&str, Parts<'_>>,
    ) -> serde_json::Result<Self> {
        let records = &prepared.records;
        let modules = records
            .modules
            .iter()
            .map(|(path, record)| ((*path).to_owned(), module(records, path, record)))
            .collect();
        let stories = prepared
            .exporters()
            .filter_map(|(module, closure)| match closure {
                Common::Renderer => None,
                Common::Preview(root) => Some((module.to_owned(), root.map(str::to_owned))),
            })
            .collect();
        Ok(Self {
            modules,
            stories,
            shared: Sha256::digest(prepared.shared.as_bytes()).into(),
            renderer: common(prepared.renderer, renderer)?,
            previews: previews
                .iter()
                .map(|(&root, parts)| Ok((root.to_owned(), common(Some(root), parts)?)))
                .collect::<serde_json::Result<_>>()?,
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

    /// Shared records must agree before any previous key can be reused.
    pub(crate) fn same_shared(&self, previous: &Self) -> bool {
        self.shared == previous.shared
    }

    /// The exporter must still use the same renderer or preview closure.
    pub(crate) fn same_common(&self, previous: &Self, module: &str, closure: Common<'_>) -> bool {
        let old_story = previous
            .stories
            .binary_search_by(|(name, _)| name.as_str().cmp(module))
            .ok();
        match closure {
            Common::Renderer => old_story.is_none() && self.renderer == previous.renderer,
            Common::Preview(root) => {
                old_story.is_some_and(|index| previous.stories[index].1.as_deref() == root)
                    && root.is_none_or(|root| self.preview(root) == previous.preview(root))
            }
        }
    }

    fn preview(&self, root: &str) -> Option<[u8; 32]> {
        let index = self
            .previews
            .binary_search_by(|(name, _)| name.as_str().cmp(root))
            .ok()?;
        Some(self.previews[index].1)
    }

    /// Heap capacities; the owning lazy cell accounts for the inline facts storage.
    pub(crate) fn heap_bytes(&self) -> usize {
        self.modules.capacity() * size_of::<(String, [u8; 32])>()
            + self
                .modules
                .iter()
                .map(|(path, _)| path.capacity())
                .sum::<usize>()
            + self.stories.capacity() * size_of::<(String, Option<String>)>()
            + self
                .stories
                .iter()
                .map(|(path, root)| path.capacity() + root.as_ref().map_or(0, String::capacity))
                .sum::<usize>()
            + self.previews.capacity() * size_of::<(String, [u8; 32])>()
            + self
                .previews
                .iter()
                .map(|(root, _)| root.capacity())
                .sum::<usize>()
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
