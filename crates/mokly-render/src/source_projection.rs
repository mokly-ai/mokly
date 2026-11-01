//! Batch source metadata without changing the side's projection and alias rules.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{FileKind, Node, SourceTree};

use crate::source_paths::Projection;
use crate::sources::SideTree;

impl SideTree {
    pub(crate) fn project_source(
        &self,
        path: &Path,
        project: &Projection<'_>,
        dependency: &Projection<'_>,
    ) -> Result<Option<Node>> {
        if let Some((_, mut node)) = self.source_with(path, project)? {
            node.identity = path.into();
            return Ok(Some(node));
        }
        if path == self.root.join("node_modules/.mokly-roots")
            || path == self.root.join("node_modules") && self.dependency_roots.len() > 1
        {
            return Ok(Some(Node {
                identity: path.into(),
                lexical_kind: FileKind::Directory,
                kind: FileKind::Directory,
            }));
        }
        let Some((root, physical, relative)) = self.mapped(path) else {
            return project(path);
        };
        let Some(mut node) = dependency(&physical)? else {
            return Ok(None);
        };
        if let Some(source) = self.source_alias(&node.identity) {
            return project(&source);
        }
        let Some(root) = dependency(&root)? else {
            return Ok(None);
        };
        if !node.identity.starts_with(&root.identity)
            && !self
                .dependency_roots
                .iter()
                .any(|root| node.identity.starts_with(root))
        {
            return Ok(None);
        }
        node.identity = self.root.join(relative);
        Ok(Some(node))
    }

    pub(crate) fn project_sources(&self, paths: &[PathBuf]) -> Vec<Result<Option<Node>>> {
        let dependencies = Projections {
            tree: self.dependencies.as_ref(),
            values: RefCell::new(BTreeMap::new()),
        };
        let mut sources = BTreeSet::new();
        for path in paths {
            sources.extend(self.source_candidates(path));
            if let Some((_, physical, _)) = self.mapped(path) {
                if let Ok(Some(node)) = dependencies.project(&physical)
                    && let Some(source) = self.source_alias(&node.identity)
                {
                    sources.insert(source);
                }
            } else {
                sources.insert(path.clone());
            }
        }
        let requested: Vec<_> = sources.into_iter().collect();
        let values = if requested.is_empty() {
            BTreeMap::new()
        } else {
            requested
                .iter()
                .cloned()
                .zip(self.sources.project_batch(&requested))
                .collect()
        };
        let sources = Projections {
            tree: self.sources.as_ref(),
            values: RefCell::new(values),
        };
        paths
            .iter()
            .map(|path| {
                self.project_source(path, &|path| sources.project(path), &|path| {
                    dependencies.project(path)
                })
            })
            .collect()
    }
}

struct Projections<'a> {
    tree: &'a dyn SourceTree,
    values: RefCell<BTreeMap<PathBuf, Result<Option<Node>>>>,
}

impl Projections<'_> {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let retained = { self.values.borrow_mut().remove(path) };
        let result = retained.unwrap_or_else(|| self.tree.project(path));
        if let Ok(node) = &result {
            self.values
                .borrow_mut()
                .insert(path.into(), Ok(node.clone()));
        }
        result
    }
}
