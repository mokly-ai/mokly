//! Source-tree projection over one immutable Git index and bounded blob batches.

use std::collections::BTreeMap;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use mokly_git::identity::RepoPath;
use mokly_git::tree::{Limits, Mode};
use mokly_source_interface::error::{InternalError, Result, SourceError};
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

use crate::error::Error;
use crate::source_cache::SourceCache;
use crate::source_failures::SourceFailures;
use crate::sources::{Sources, TreeIndex};

/// Git files share the working tree's private absolute namespace without reading it.
pub struct GitTree {
    root: PathBuf,
    sources: Arc<dyn Sources>,
    bound: usize,
    cache: Mutex<SourceCache>,
    failure: Mutex<Option<Arc<Error>>>,
    children: OnceLock<BTreeMap<String, Vec<Child>>>,
}

impl GitTree {
    /// Create an adapter without IO, with a byte-bounded per-file LRU.
    pub fn new(root: PathBuf, sources: Arc<dyn Sources>, bytes: usize) -> Self {
        Self {
            root,
            sources,
            bound: bytes,
            cache: Mutex::new(SourceCache::new(bytes)),
            failure: Mutex::new(None),
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
            Err(source) => Err(self.failed("index", path, source)),
        }
    }
    fn failed(&self, operation: &'static str, path: &Path, source: Error) -> SourceError {
        let source = Arc::new(source);
        self.failure
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get_or_insert_with(|| source.clone());
        adapter(operation, path, source)
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
        if let Some(bytes) = self
            .cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&relative)
        {
            return Ok(bytes);
        }
        let mut contents = match self
            .sources
            .read_many(std::slice::from_ref(&relative), Limits::default())
        {
            Ok(contents) => contents,
            Err(source) => return Err(self.failed("read", path, source)),
        };
        let bytes = contents
            .pop()
            .ok_or_else(|| failure("read", path, io::ErrorKind::UnexpectedEof))?;
        self.cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(relative, bytes.clone());
        Ok(bytes)
    }

    fn prefetch(&self, requested: &[PathBuf]) -> Result<()> {
        let index = self.index(&self.root)?;
        let mut batches = Vec::new();
        let mut paths = Vec::new();
        let mut total = 0usize;
        for path in requested {
            let Some(relative) = self.relative(path)? else {
                continue;
            };
            let Some(entry) = index
                .entries
                .get(&relative)
                .filter(|entry| entry.mode.regular())
            else {
                continue;
            };
            if self
                .cache
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .contains(&relative)
            {
                continue;
            }
            let cost = entry
                .size
                .saturating_add(relative.as_str().len())
                .saturating_add(128);
            if cost > self.bound.min(48 * 1024 * 1024) {
                continue;
            }
            if paths.len() == 4096 || total.saturating_add(cost) > self.bound.min(48 * 1024 * 1024)
            {
                batches.push(std::mem::take(&mut paths));
                total = 0;
            }
            total += cost;
            paths.push(relative);
        }
        if !paths.is_empty() {
            batches.push(paths);
        }
        for paths in batches {
            let bytes = match self.sources.read_many(&paths, Limits::default()) {
                Ok(bytes) => bytes,
                Err(source) => return Err(self.failed("prefetch", &self.root, source)),
            };
            let mut cache = self.cache.lock().unwrap_or_else(|error| error.into_inner());
            for (path, bytes) in paths.into_iter().zip(bytes) {
                cache.insert(path, bytes);
            }
        }
        Ok(())
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

#[cfg(test)]
#[path = "_tests_/git_tree_scale_tests.rs"]
mod git_tree_scale_tests;

impl SourceFailures for GitTree {
    fn failure(&self) -> Option<Arc<Error>> {
        self.failure
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }
}
