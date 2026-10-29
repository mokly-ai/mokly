//! Project indexed leaves and their directory ancestors without another Git lookup.

use std::ops::Bound;
use std::path::Path;

use mokly_git::identity::RepoPath;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{FileKind, Node};

use crate::git_tree::{GitTree, kind};
use crate::sources::TreeIndex;

impl GitTree {
    pub(crate) fn project_node(&self, path: &Path) -> Result<Option<Node>> {
        let kind = if let Some(relative) = self.relative(path)? {
            let index = self.index(path)?;
            if let Some(kind) = indexed_kind(&index, &relative) {
                kind
            } else {
                if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
                    return Err(self.failed("project", path, source));
                }
                let index = self.index(path)?;
                let Some(kind) = indexed_kind(&index, &relative) else {
                    return Ok(None);
                };
                kind
            }
        } else {
            FileKind::Directory
        };
        Ok(Some(Node {
            identity: path.into(),
            lexical_kind: kind,
            kind,
        }))
    }
}

fn indexed_kind(index: &TreeIndex, relative: &RepoPath) -> Option<FileKind> {
    if let Some(entry) = index.entries.get(relative) {
        return Some(kind(entry.mode));
    }
    let prefix = format!("{relative}/");
    index
        .entries
        .range::<str, _>((Bound::Included(prefix.as_str()), Bound::Unbounded))
        .next()
        .filter(|(path, _)| path.as_str().starts_with(&prefix))
        .map(|_| FileKind::Directory)
}
