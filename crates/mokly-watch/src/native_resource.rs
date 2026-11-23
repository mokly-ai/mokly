//! Resource attachment qualifies only new ancestors and leaves existing watches in place.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, Result};
use crate::native::State;

pub(super) fn attach(
    tree: &dyn SourceTree,
    state: &mut State,
    repository: &Path,
    path: &Path,
) -> Result<()> {
    if !path.starts_with(repository)
        || path
            .parent()
            .is_some_and(|parent| state.root_directories.contains(parent))
    {
        return Ok(());
    }
    let mut parents = BTreeSet::<PathBuf>::new();
    for parent in path
        .ancestors()
        .skip(1)
        .filter(|parent| parent.starts_with(repository))
    {
        if state.directories.contains(parent) {
            parents.insert(parent.into());
            continue;
        }
        let node = match tree.project(parent) {
            Ok(node) => node,
            Err(source) => return Err(InternalError::Source { source }.into()),
        };
        if node.is_some_and(|node| node.kind == FileKind::Directory && node.identity == parent) {
            parents.insert(parent.into());
        }
    }
    let add: BTreeSet<_> = parents.difference(&state.directories).cloned().collect();
    if !add.is_empty() {
        let attached = state.watcher.update(&add, &BTreeSet::new())?;
        state.directories.extend(attached);
    }
    state.parents.insert(path.into(), parents);
    Ok(())
}
