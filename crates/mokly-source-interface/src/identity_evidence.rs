//! Compare an opened-file witness with the current object and resolved name.

use std::path::Path;

use crate::read_evidence::FileIdentity;
use crate::tree::SourceTree;

fn comparable(path: &Path) -> std::path::PathBuf {
    let text = path.to_string_lossy();
    let text = text
        .strip_prefix(r"\\?\UNC\")
        .map(|rest| format!(r"\\{rest}"))
        .or_else(|| text.strip_prefix(r"\\?\").map(str::to_owned));
    text.map_or_else(|| path.to_path_buf(), std::path::PathBuf::from)
}

/// Missing metadata remains a mismatch for an existing descriptor-bound witness.
pub fn matches(tree: &dyn SourceTree, path: &Path, identity: &FileIdentity) -> bool {
    let Some(node) = tree.project(path).ok().flatten() else {
        return false;
    };
    identity
        .canonical
        .as_ref()
        .is_none_or(|name| comparable(name) == comparable(&node.identity))
        && tree.file_object(&node.identity).ok().flatten().as_deref() == Some(&identity.object)
}
