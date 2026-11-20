//! Confined directory inventories exclude denied and symlinked descendants.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, Result};
use crate::plan::Plan;

/// Successful directory qualifications shared only within one observation pass.
pub(super) struct DirectoryChecks<'a> {
    tree: &'a dyn SourceTree,
    qualified: BTreeMap<PathBuf, bool>,
}

impl<'a> DirectoryChecks<'a> {
    /// Start a fresh pass without retaining filesystem observations.
    pub(super) fn new(tree: &'a dyn SourceTree) -> Self {
        Self {
            tree,
            qualified: BTreeMap::new(),
        }
    }

    fn canonical_directory(&mut self, path: &Path) -> bool {
        if let Some(qualified) = self.qualified.get(path) {
            return *qualified;
        }
        let Ok(node) = self.tree.project(path) else {
            return false;
        };
        let qualified =
            node.is_some_and(|node| node.kind == FileKind::Directory && node.identity == path);
        self.qualified.insert(path.into(), qualified);
        qualified
    }

    fn parents(&mut self, path: &Path, boundary: &Path) -> BTreeSet<PathBuf> {
        path.ancestors()
            .skip(1)
            .filter(|path| path.starts_with(boundary))
            .filter(|path| self.canonical_directory(path))
            .map(Path::to_owned)
            .collect()
    }

    /// Qualify parents and membership directories within each input's boundaries.
    pub(super) fn input_parents(&mut self, path: &Path, plan: &Plan) -> BTreeSet<PathBuf> {
        let mut result = self.parents(path, &plan.repository);
        if let Some(root) = plan.dependency_roots.get(path) {
            result.extend(self.parents(path, root));
        }
        if plan.resolution_directories.contains_key(path)
            && (path.starts_with(&plan.repository)
                || plan
                    .dependency_roots
                    .get(path)
                    .is_some_and(|root| path.starts_with(root)))
            && self.canonical_directory(path)
        {
            result.insert(path.into());
        }
        result
    }

    /// Inventory root directories with live child reads and bounded parent checks.
    pub(super) fn directories(&mut self, plan: &Plan) -> Result<BTreeSet<PathBuf>> {
        let mut plan = plan.clone();
        plan.exact.clear();
        plan.ancestors.clear();
        let mut result = BTreeSet::new();
        let mut visited = BTreeSet::new();
        let mut pending: Vec<_> = plan.roots.iter().cloned().collect();
        for path in &plan.roots {
            result.extend(self.parents(path, &plan.repository));
        }
        while let Some(directory) = pending.pop() {
            if plan.denied(&directory, true) || !visited.insert(directory.clone()) {
                continue;
            }
            result.insert(directory.clone());
            let children = match self.tree.children(&directory) {
                Ok(children) => children,
                Err(source) if source.is_vanished() => {
                    result.remove(&directory);
                    continue;
                }
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            for child in children {
                if child.kind == FileKind::Directory {
                    pending.push(directory.join(child.name));
                }
            }
        }
        Ok(result)
    }
}
