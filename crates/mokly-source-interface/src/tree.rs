//! Object-safe filesystem and Git-tree boundary.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use sha2::{Digest, Sha256};

use crate::error::Result;

/// An entry's kind before following any symbolic link.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FileKind {
    /// Regular file.
    File,
    /// Directory.
    Directory,
    /// Symbolic link, never traversed below a root.
    Symlink,
    /// Socket, device, or another non-source node.
    Other,
}

/// A projected node, with symbolic links resolved by the tree adapter.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Node {
    /// Physical or tree-local canonical identity.
    pub identity: PathBuf,
    /// Kind of the lexical node before following the final symbolic link.
    pub lexical_kind: FileKind,
    /// Kind of the projected target.
    pub kind: FileKind,
}

/// One directory child; the kind describes the lexical entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Child {
    /// Child basename, with no directory separators.
    pub name: String,
    /// Kind without following links.
    pub kind: FileKind,
}

/// Read-only source access. All paths belong to the adapter's source tree.
/// Missing and replaced paths project to `None`. Reads preserve their errors.
#[cfg_attr(feature = "mock", unimock::unimock(api = SourceTreeMock))]
pub trait SourceTree: Send + Sync {
    /// Resolve a repository, root, or candidate identity once per pass.
    fn project(&self, path: &Path) -> Result<Option<Node>>;
    /// List direct children of a projected directory identity without following links.
    fn children(&self, path: &Path) -> Result<Vec<Child>>;
    /// Read the bytes of one confined, inventoried source.
    fn read(&self, path: &Path) -> Result<Vec<u8>>;
    /// Read immutable bytes without copying a retained source on cache hits.
    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        Ok(self.read(path)?.into())
    }
    /// Hash an inventoried regular file without requiring callers to retain its bytes.
    fn digest(&self, path: &Path) -> Result<String> {
        Ok(Sha256::digest(self.read_shared(path)?)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect())
    }
}
