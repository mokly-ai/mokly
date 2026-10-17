//! Map logical dependency graph names to the selected installation for this side.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::ancestor_roots::dependency_directory;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{Child, Node, SourceTree};

use crate::dependency_usage::DependencyUsage;
use crate::runtime::Runtime;
use crate::side::{BaseSide, SideInputs, dependency_roots};
use crate::source_paths::{self, INSTALLED_INPUT_PREFIX};

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
    fn digest(&self, path: &Path) -> mokly_source_interface::error::Result<String> {
        self.tree.digest(path)
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
    fn mapped(&self, path: &Path) -> Option<(PathBuf, PathBuf, PathBuf)> {
        let relative = path.strip_prefix(&self.root).ok()?;
        let text = relative.to_string_lossy().replace('\\', "/");
        let text = text.strip_prefix(INSTALLED_INPUT_PREFIX).unwrap_or(&text);
        if !text.starts_with("node_modules/") && text != "node_modules" {
            let directory = dependency_directory(text)?;
            let root = self
                ._base
                .as_ref()
                .and_then(|base| base.dependencies.node_modules.parent())
                .unwrap_or(&self.root);
            return Some((root.join(directory), root.join(text), relative.to_owned()));
        }
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
        Some((root.clone(), root.join(rest), relative.to_owned()))
    }

    fn source(&self, path: &Path) -> Result<Option<(PathBuf, Node)>> {
        if self._base.is_none() {
            return Ok(None);
        }
        let Ok(relative) = path.strip_prefix(&self.root) else {
            return Ok(None);
        };
        source_paths::source_node(
            self.sources.as_ref(),
            &self.root,
            &self.aliases,
            &relative.to_string_lossy().replace('\\', "/"),
        )
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
    fn selected(&self, path: &Path) -> Result<(&dyn SourceTree, PathBuf)> {
        if let Some((source, _)) = self.source(path)? {
            return Ok((self.sources.as_ref(), source));
        }
        if let Some((_, physical, _)) = self.mapped(path) {
            if let Some(node) = self.dependencies.project(&physical)?
                && let Some(source) = self.source_alias(&node.identity)
            {
                return Ok((self.sources.as_ref(), source));
            }
            Ok((self.dependencies.as_ref(), physical))
        } else {
            Ok((self.sources.as_ref(), path.into()))
        }
    }

    fn record(&self, path: &Path) {
        if path.extension().is_some_and(|extension| extension == "css")
            && let Ok(relative) = path.strip_prefix(&self.root)
        {
            self.usage.record(
                &self.aliases,
                &relative.to_string_lossy().replace('\\', "/"),
            );
        }
    }
}

impl SourceTree for SideTree {
    fn prefetch(&self, paths: &[PathBuf]) -> Result<()> {
        let mut sources = Vec::new();
        let mut dependencies = Vec::new();
        for path in paths {
            if let Some((source, _)) = self.source(path)? {
                sources.push(source);
            } else if let Some((_, physical, _)) = self.mapped(path) {
                if let Some(node) = self.dependencies.project(&physical)?
                    && let Some(source) = self.source_alias(&node.identity)
                {
                    sources.push(source);
                } else {
                    dependencies.push(physical);
                }
            } else {
                sources.push(path.clone());
            }
        }
        if !sources.is_empty() {
            self.sources.prefetch(&sources)?;
        }
        if !dependencies.is_empty() {
            self.dependencies.prefetch(&dependencies)?;
        }
        Ok(())
    }
    fn digest(&self, path: &Path) -> Result<String> {
        let (tree, physical) = self.selected(path)?;
        let hash = tree.digest(&physical)?;
        self.record(path);
        Ok(hash)
    }
    fn read_public(&self, path: &Path) -> Result<Vec<u8>> {
        let (tree, physical) = self.selected(path)?;
        let bytes = tree.read_public(&physical)?;
        self.record(path);
        Ok(bytes)
    }
    fn read_shared(&self, path: &Path) -> Result<Arc<[u8]>> {
        let (tree, physical) = self.selected(path)?;
        let bytes = tree.read_shared(&physical)?;
        self.record(path);
        Ok(bytes)
    }
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        if let Some((_, mut node)) = self.source(path)? {
            node.identity = path.into();
            return Ok(Some(node));
        }
        if path == self.root.join("node_modules/.mokly-roots") {
            return Ok(Some(Node {
                identity: path.into(),
                lexical_kind: mokly_source_interface::tree::FileKind::Directory,
                kind: mokly_source_interface::tree::FileKind::Directory,
            }));
        }
        let Some((root, physical, relative)) = self.mapped(path) else {
            return self.sources.project(path);
        };
        let Some(mut node) = self.dependencies.project(&physical)? else {
            return Ok(None);
        };
        if let Some(source) = self.source_alias(&node.identity) {
            return self.sources.project(&source);
        }
        let Some(root) = self.dependencies.project(&root)? else {
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

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        let (tree, physical) = self.selected(path)?;
        tree.children(&physical)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let (tree, physical) = self.selected(path)?;
        let bytes = tree.read(&physical)?;
        self.record(path);
        Ok(bytes)
    }
}

pub(crate) fn reader(
    runtime: &Runtime,
    config: &ResolvedConfig,
    side: &SideInputs,
) -> Arc<dyn SourceTree> {
    Arc::new(SideTree {
        _base: runtime.base.clone(),
        usage: runtime.dependency_usage.clone(),
        aliases: side.dependency_aliases.clone(),
        sources: runtime.tree.clone(),
        dependencies: runtime.dependency_tree.clone(),
        root: config.repo_root.clone(),
        dependency_roots: dependency_roots(side),
        repository_roots: side.repository_roots.clone(),
    })
}
