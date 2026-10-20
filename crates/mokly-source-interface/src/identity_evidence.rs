//! Compare an opened-file witness with the current object and resolved name.

use std::path::Path;

use crate::read_evidence::FileIdentity;
use crate::tree::SourceTree;

/// Missing metadata remains a mismatch for an existing descriptor-bound witness.
pub fn matches(tree: &dyn SourceTree, path: &Path, identity: &FileIdentity) -> bool {
    let Some(node) = tree.project(path).ok().flatten() else {
        return false;
    };
    identity
        .canonical
        .as_ref()
        .is_none_or(|name| *name == node.identity)
        && tree.file_object(&node.identity).ok().flatten().as_deref() == Some(&identity.object)
}
