//! Only confined regular resources contribute digests to public document keys.

use std::path::Path;

use mokly_source_interface::tree::{FileKind, SourceTree};

/// Whether `path` names a regular file inside `root`.
pub(crate) fn exists(tree: &dyn SourceTree, root: &Path, path: &str) -> bool {
    matches!(
        tree.project(&root.join(path)),
        Ok(Some(node)) if node.kind == FileKind::File && node.identity.starts_with(root)
    )
}

pub(crate) fn confined(tree: &dyn SourceTree, root: &Path, path: &str) -> Option<String> {
    let node = tree.project(&root.join(path)).ok()??;
    if node.kind != FileKind::File || !node.identity.starts_with(root) {
        return None;
    }
    tree.digest(&node.identity).ok()
}

#[cfg(test)]
#[path = "_tests_/resource_digest_tests.rs"]
mod resource_digest_tests;
