//! Map logical dependency graph names to the selected installation for this side.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::dependency_usage::DependencyUsage;
use crate::side::BaseSide;

/// Dependency paths retain logical names while source bytes use their own tree.
pub(crate) struct SideTree {
    pub(crate) _base: Option<Arc<BaseSide>>,
    pub(crate) sources: Arc<dyn SourceTree>,
    pub(crate) dependencies: Arc<dyn SourceTree>,
    pub(crate) usage: Arc<dyn DependencyUsage>,
    pub(crate) aliases: BTreeMap<String, String>,
    pub(crate) root: PathBuf,
    pub(crate) dependency_roots: Vec<PathBuf>,
    pub(crate) repository_roots: Vec<PathBuf>,
}

/// Keep the extraction and dependency leases until the last graph reader closes.
pub(crate) struct LeasedTree {
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) _base: Option<Arc<BaseSide>>,
}

impl SourceTree for LeasedTree {
    fn prefetch(&self, paths: &[PathBuf]) -> mokly_source_interface::error::Result<()> {
        self.tree.prefetch(paths)
    }
    fn read_public(&self, path: &Path) -> mokly_source_interface::error::Result<Vec<u8>> {
        self.tree.read_public(path)
    }
    fn public_digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.tree.public_digest(path)
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        self.tree.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        self.tree.children(path)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        self.tree.read(path)
    }
    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        self.tree.read_shared(path)
    }
}

impl SideTree {
    fn mapped(&self, path: &Path) -> Option<(usize, PathBuf, PathBuf)> {
        let relative = path.strip_prefix(&self.root).ok()?;
        let text = relative.to_string_lossy().replace('\\', "/");
        let rest = if text == "node_modules" {
            ""
        } else {
            text.strip_prefix("node_modules/")?
        };
        let (index, rest) = if let Some(rest) = rest.strip_prefix(".mokly-roots/") {
            let (index, rest) = rest.split_once('/').unwrap_or((rest, ""));
            (index.parse::<usize>().ok()?, rest)
        } else {
            (0, rest)
        };
        if !rest.is_empty() && rest.split('/').any(|part| matches!(part, "" | "." | "..")) {
            return None;
        }
        let root = self.dependency_roots.get(index)?;
        Some((index, root.join(rest), relative.to_owned()))
    }

    fn source_alias(&self, identity: &Path) -> Option<PathBuf> {
        if self
            .dependency_roots
            .iter()
            .any(|root| identity.starts_with(root))
        {
            return None;
        }
        if identity
            .components()
            .any(|part| part.as_os_str() == "node_modules")
        {
            return None;
        }
        self.repository_roots
            .iter()
            .find_map(|root| identity.strip_prefix(root).ok())
            .map(|relative| self.root.join(relative))
    }
}

impl SourceTree for SideTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        if path == self.root.join("node_modules/.mokly-roots") {
            return Ok(Some(Node {
                identity: path.into(),
                lexical_kind: mokly_source_interface::tree::FileKind::Directory,
                kind: mokly_source_interface::tree::FileKind::Directory,
            }));
        }
        let Some((index, physical, relative)) = self.mapped(path) else {
            return self.sources.project(path);
        };
        let Some(mut node) = self.dependencies.project(&physical)? else {
            return Ok(None);
        };
        if let Some(source) = self.source_alias(&node.identity) {
            return self.sources.project(&source);
        }
        let Some(root) = self.dependencies.project(&self.dependency_roots[index])? else {
            return Ok(None);
        };
        if !node.identity.starts_with(&root.identity) {
            return Ok(None);
        }
        node.identity = self.root.join(relative);
        Ok(Some(node))
    }

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        if let Some((_, physical, _)) = self.mapped(path) {
            self.dependencies.children(&physical)
        } else {
            self.sources.children(path)
        }
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let bytes = if let Some((_, physical, _)) = self.mapped(path) {
            if let Some(node) = self.dependencies.project(&physical)?
                && let Some(source) = self.source_alias(&node.identity)
            {
                self.sources.read(&source)?
            } else {
                self.dependencies.read(&physical)?
            }
        } else {
            self.sources.read(path)?
        };
        if path.extension().is_some_and(|extension| extension == "css")
            && let Ok(relative) = path.strip_prefix(&self.root)
        {
            self.usage.record(
                &self.aliases,
                &relative.to_string_lossy().replace('\\', "/"),
            );
        }
        Ok(bytes)
    }
}
