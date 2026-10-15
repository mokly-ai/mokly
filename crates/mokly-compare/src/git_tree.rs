//! Source-tree projection over one immutable Git index and bounded blob batches.

use std::collections::BTreeMap;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use mokly_git::identity::RepoPath;
use mokly_git::tree::{Limits, Mode};
use mokly_source_interface::error::{InternalError, Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

use crate::sources::{Sources, TreeIndex};

/// Git files share the working tree's private absolute namespace without reading it.
pub struct GitTree {
    root: PathBuf,
    sources: Arc<dyn Sources>,
    bound: usize,
    cache: Mutex<BTreeMap<RepoPath, Vec<u8>>>,
    children: OnceLock<BTreeMap<String, Vec<Child>>>,
}

impl GitTree {
    /// Create an adapter without IO. A read caches at most one bounded blob batch.
    pub fn new(root: PathBuf, sources: Arc<dyn Sources>, bytes: usize) -> Self {
        Self {
            root,
            sources,
            bound: bytes,
            cache: Mutex::new(BTreeMap::new()),
            children: OnceLock::new(),
        }
    }

    fn relative(&self, path: &Path) -> Result<Option<RepoPath>> {
        let Ok(relative) = path.strip_prefix(&self.root) else {
            return Err(failure("project", path, io::ErrorKind::PermissionDenied));
        };
        if relative.as_os_str().is_empty() {
            return Ok(None);
        }
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(failure("project", path, io::ErrorKind::InvalidInput));
        }
        let text = relative
            .to_string_lossy()
            .replace(std::path::MAIN_SEPARATOR, "/");
        match RepoPath::parse(&text) {
            Ok(path) => Ok(Some(path)),
            Err(source) => Err(adapter("project", path, source)),
        }
    }

    fn index(&self, path: &Path) -> Result<Arc<TreeIndex>> {
        match self.sources.index() {
            Ok(index) => Ok(index),
            Err(source) => Err(adapter("index", path, source)),
        }
    }
}

impl SourceTree for GitTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let relative = self.relative(path)?;
        let kind = if let Some(relative) = relative {
            let index = self.index(path)?;
            let Some(entry) = index.entries.get(&relative) else {
                return Ok(None);
            };
            kind(entry.mode)
        } else {
            FileKind::Directory
        };
        Ok(Some(Node {
            identity: path.to_path_buf(),
            lexical_kind: kind,
            kind,
        }))
    }

    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        let relative = self.relative(path)?;
        let index = self.index(path)?;
        if let Some(relative) = &relative {
            match index.entries.get(relative) {
                None => return Err(failure("children", path, io::ErrorKind::NotFound)),
                Some(entry) if entry.mode != Mode::Directory => {
                    return Err(failure("children", path, io::ErrorKind::NotADirectory));
                }
                _ => {}
            }
        }
        let children = self.children.get_or_init(|| {
            let mut children: BTreeMap<String, Vec<Child>> = BTreeMap::new();
            for entry in index.entries.values() {
                let (parent, name) = entry
                    .path
                    .as_str()
                    .rsplit_once('/')
                    .unwrap_or(("", entry.path.as_str()));
                children.entry(parent.into()).or_default().push(Child {
                    name: name.into(),
                    kind: kind(entry.mode),
                });
            }
            children
        });
        Ok(children
            .get(relative.as_ref().map_or("", RepoPath::as_str))
            .cloned()
            .unwrap_or_default())
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("read", path, io::ErrorKind::IsADirectory));
        };
        let index = self.index(path)?;
        let Some(entry) = index.entries.get(&relative) else {
            return Err(failure("read", path, io::ErrorKind::NotFound));
        };
        if !entry.mode.regular() {
            return Err(failure("read", path, io::ErrorKind::InvalidInput));
        }
        let mut cache = match self.cache.lock() {
            Ok(cache) => cache,
            Err(_) => return Err(failure("read", path, io::ErrorKind::Other)),
        };
        if let Some(bytes) = cache.get(&relative) {
            return Ok(bytes.clone());
        }
        let mut total = 0usize;
        let mut paths = Vec::new();
        for (_, candidate) in index.entries.range(relative.clone()..) {
            if !candidate.mode.regular() {
                continue;
            }
            let cost = candidate
                .size
                .saturating_add(candidate.path.as_str().len())
                .saturating_add(128);
            if paths.len() == 4096 || total.saturating_add(cost) > self.bound.min(48 * 1024 * 1024)
            {
                break;
            }
            total += cost;
            paths.push(candidate.path.clone());
        }
        if paths.is_empty() {
            paths.push(relative.clone());
        }
        let contents = match self.sources.read_many(&paths, Limits::default()) {
            Ok(contents) => contents,
            Err(source) => return Err(adapter("read", path, source)),
        };
        cache.clear();
        let mut selected = None;
        for (key, bytes) in paths.into_iter().zip(contents) {
            if key == relative {
                selected = Some(bytes.clone());
            }
            if total > 0 && total <= self.bound {
                cache.insert(key, bytes);
            }
        }
        selected.ok_or_else(|| failure("read", path, io::ErrorKind::UnexpectedEof))
    }
}

fn kind(mode: Mode) -> FileKind {
    match mode {
        Mode::File | Mode::Executable => FileKind::File,
        Mode::Directory => FileKind::Directory,
        Mode::Symlink => FileKind::Symlink,
        Mode::Submodule => FileKind::Other,
    }
}

fn failure(operation: &'static str, path: &Path, kind: io::ErrorKind) -> SourceError {
    SourceError::Io {
        operation,
        path: path.into(),
        source: io::Error::from(kind),
    }
}

fn adapter(
    operation: &'static str,
    path: &Path,
    source: impl std::error::Error + Send + Sync + 'static,
) -> SourceError {
    InternalError::Adapter {
        operation,
        path: path.into(),
        source: Box::new(source),
    }
    .into()
}

#[cfg(test)]
#[path = "_tests_/git_tree_tests.rs"]
mod git_tree_tests;
