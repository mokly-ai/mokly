//! Indexed navigation tree construction with English title and authored variant order.

use std::collections::{BTreeMap, BTreeSet};

use icu_collator::{Collator, CollatorBorrowed};
use icu_locale_core::locale;

use crate::canonical::compare_utf16;
use crate::catalogue::{CatalogueModel, FolderRecord, ModelEntry};
use crate::paths::title_from_slug;
use crate::public_index::{CatalogueNode, True};

struct Tree<'a> {
    entries: BTreeMap<&'a str, &'a ModelEntry>,
    folders: BTreeMap<&'a str, &'a FolderRecord>,
    children: BTreeMap<String, BTreeSet<String>>,
    variants: BTreeMap<&'a str, Vec<&'a str>>,
    collator: Option<CollatorBorrowed<'static>>,
}

pub(crate) fn build(model: &CatalogueModel) -> Vec<CatalogueNode> {
    let mut tree = Tree {
        entries: model
            .entries
            .iter()
            .map(|entry| (entry.metadata.path.as_str(), entry))
            .collect(),
        folders: model
            .folders
            .iter()
            .map(|folder| (folder.path.as_str(), folder))
            .collect(),
        children: BTreeMap::new(),
        variants: BTreeMap::new(),
        collator: Collator::try_new(locale!("en").into(), Default::default()).ok(),
    };
    for entry in &model.entries {
        let path = entry.metadata.path.as_str();
        if let Some(parent) = entry.metadata.variant_of.as_deref() {
            tree.variants.entry(parent).or_default().push(path);
            continue;
        }
        let mut parent = String::new();
        for slug in path.split('/') {
            let child = if parent.is_empty() {
                slug.into()
            } else {
                format!("{parent}/{slug}")
            };
            tree.children
                .entry(parent)
                .or_default()
                .insert(child.clone());
            parent = child;
        }
    }
    tree.children("")
}

impl Tree<'_> {
    fn children(&self, parent: &str) -> Vec<CatalogueNode> {
        let mut pending = vec![(parent, false)];
        let mut built = BTreeMap::new();
        while let Some((path, visited)) = pending.pop() {
            if !visited {
                pending.push((path, true));
                pending.extend(
                    self.children
                        .get(path)
                        .into_iter()
                        .flatten()
                        .rev()
                        .map(|child| (child.as_str(), false)),
                );
                continue;
            }
            let mut members: Vec<_> = self
                .children
                .get(path)
                .into_iter()
                .flatten()
                .filter_map(|child| built.remove(child.as_str()))
                .collect();
            self.sort_children(path, &mut members);
            if path == parent {
                return members;
            }
            built.insert(path, self.node(path, members));
        }
        Vec::new()
    }

    fn sort_children(&self, parent: &str, result: &mut [CatalogueNode]) {
        let order = self
            .folders
            .get(parent)
            .and_then(|folder| folder.order.as_ref());
        result.sort_by(|a, b| {
            let rank = |node: &CatalogueNode| {
                let slug = path(node).rsplit('/').next().unwrap_or("");
                order
                    .and_then(|order| order.iter().position(|item| item == slug))
                    .unwrap_or_else(|| {
                        order
                            .and_then(|order| order.iter().position(|item| item == "..."))
                            .unwrap_or(usize::MAX)
                    })
            };
            rank(a)
                .cmp(&rank(b))
                .then_with(|| {
                    matches!(a, CatalogueNode::Entry { .. })
                        .cmp(&matches!(b, CatalogueNode::Entry { .. }))
                })
                .then_with(|| {
                    self.collator.as_ref().map_or_else(
                        || compare_utf16(self.label(a), self.label(b)),
                        |collator| collator.compare(self.label(a), self.label(b)),
                    )
                })
                .then_with(|| compare_utf16(path(a), path(b)))
        });
    }

    fn node(&self, path: &str, mut members: Vec<CatalogueNode>) -> CatalogueNode {
        let entry = self.entries.get(path).copied();
        let folder = self.folders.get(path).copied();
        let hidden = folder
            .filter(|folder| folder.hidden == Some(true))
            .map(|_| True);
        let order = folder.and_then(|folder| folder.order.clone());
        if let Some(entry) = entry {
            let mut variants: Vec<_> = self
                .variants
                .get(path)
                .into_iter()
                .flatten()
                .map(|path| leaf(path))
                .collect();
            variants.append(&mut members);
            if !entry.metadata.is_index
                || matches!(entry.content.kind().as_str(), "screen" | "component")
            {
                return CatalogueNode::Entry {
                    path: path.into(),
                    hidden,
                    order,
                    children: (!variants.is_empty()).then_some(variants),
                };
            }
            members = vec![leaf(path)];
            members.append(&mut variants);
        }
        let title = folder
            .and_then(|folder| folder.title.clone())
            .or_else(|| entry.map(|entry| entry.metadata.title.clone()))
            .unwrap_or_else(|| title_from_slug(path.rsplit('/').next().unwrap_or(path)));
        CatalogueNode::Folder {
            path: path.into(),
            title,
            index: entry.map(|_| path.into()),
            hidden,
            order,
            children: members,
        }
    }

    fn label<'a>(&'a self, node: &'a CatalogueNode) -> &'a str {
        match node {
            CatalogueNode::Folder { title, .. } => title,
            CatalogueNode::Entry { path, .. } => self
                .entries
                .get(path.as_str())
                .map_or("", |entry| entry.metadata.title.as_str()),
        }
    }
}

fn leaf(path: &str) -> CatalogueNode {
    CatalogueNode::Entry {
        path: path.into(),
        hidden: None,
        order: None,
        children: None,
    }
}
fn path(node: &CatalogueNode) -> &str {
    match node {
        CatalogueNode::Entry { path, .. } | CatalogueNode::Folder { path, .. } => path,
    }
}

#[cfg(test)]
#[path = "_tests_/projection_tree_tests.rs"]
mod projection_tree_tests;
