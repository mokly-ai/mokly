//! Confined directory inventories exclude denied and symlinked descendants.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, Result};
use crate::plan::Plan;

pub(crate) fn parents(tree: &dyn SourceTree, path: &Path, repository: &Path) -> BTreeSet<PathBuf> {
    path.ancestors().skip(1).filter(|path| path.starts_with(repository))
        .filter(|path| matches!(tree.project(path), Ok(Some(node)) if node.kind == FileKind::Directory && node.identity == *path))
        .map(Path::to_owned).collect()
}

pub(crate) fn directories(tree: &dyn SourceTree, plan: &Plan) -> Result<BTreeSet<PathBuf>> {
    let mut plan = plan.clone();
    plan.exact.clear();
    plan.ancestors.clear();
    let mut result = BTreeSet::new();
    let mut visited = BTreeSet::new();
    let mut pending: Vec<_> = plan.roots.iter().cloned().collect();
    for path in &plan.roots {
        result.extend(parents(tree, path, &plan.repository));
    }
    while let Some(directory) = pending.pop() {
        if plan.denied(&directory, true) || !visited.insert(directory.clone()) {
            continue;
        }
        result.insert(directory.clone());
        let children = match tree.children(&directory) {
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
