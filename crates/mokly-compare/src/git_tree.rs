//! Source-tree projection over one immutable Git index and bounded blob batches.

use std::collections::BTreeMap;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_git::identity::RepoPath;
use mokly_git::tree::{Limits, Mode};
use mokly_source_interface::error::{InternalError, Result, SourceError};
use mokly_source_interface::stream::SourceStream;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

use crate::error::Error;
use crate::source_cache::SourceCache;
use crate::source_failures::SourceFailures;
use crate::sources::{Sources, TreeIndex};

/// Git files share the working tree's private absolute namespace without reading it.
pub struct GitTree {
    pub(crate) root: PathBuf,
    pub(crate) sources: Arc<dyn Sources>,
    pub(crate) bound: usize,
    pub(crate) cache: Mutex<SourceCache>,
    failure: Mutex<Option<Arc<Error>>>,
    children: Mutex<DirectoryIndex>,
    pub(crate) digests: Mutex<BTreeMap<RepoPath, String>>,
}

/// Metadata only grows within a commit; rebuild child lists once per index expansion.
#[derive(Default)]
struct DirectoryIndex {
    entries: usize,
    children: BTreeMap<String, Vec<Child>>,
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
            children: Mutex::new(DirectoryIndex::default()),
            digests: Mutex::new(BTreeMap::new()),
        }
    }

    pub(crate) fn relative(&self, path: &Path) -> Result<Option<RepoPath>> {
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

    pub(crate) fn index(&self, path: &Path) -> Result<Arc<TreeIndex>> {
        match self.sources.index() {
            Ok(index) => Ok(index),
            Err(source) => Err(self.failed("index", path, source)),
        }
    }
    pub(crate) fn failed(
        &self,
        operation: &'static str,
        path: &Path,
        source: Error,
    ) -> SourceError {
        let source = Arc::new(source);
        let mut failure = self
            .failure
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if failure.as_deref().is_none_or(|previous| {
            matches!(previous, Error::Limit { .. })
                && !matches!(source.as_ref(), Error::Limit { .. })
        }) {
            *failure = Some(source.clone());
        }
        adapter(operation, path, source)
    }
}

impl SourceTree for GitTree {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        let relative = self.relative(path)?;
        let kind = if let Some(relative) = relative {
            if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
                return Err(self.failed("project", path, source));
            }
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
        if let Err(source) = self.sources.expand(relative.as_ref()) {
            return Err(self.failed("children", path, source));
        }
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
        let key = relative.as_ref().map_or("", RepoPath::as_str);
        let mut directories = self
            .children
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if directories.entries != index.entries.len() {
            directories.children.clear();
            for entry in index.entries.values() {
                let (parent, name) = entry
                    .path
                    .as_str()
                    .rsplit_once('/')
                    .unwrap_or(("", entry.path.as_str()));
                directories
                    .children
                    .entry(parent.into())
                    .or_default()
                    .push(Child {
                        name: name.into(),
                        kind: kind(entry.mode),
                    });
            }
            directories.entries = index.entries.len();
        }
        Ok(directories.children.get(key).cloned().unwrap_or_default())
    }

    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("read", path, io::ErrorKind::IsADirectory));
        };
        if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
            return Err(self.failed("read", path, source));
        }
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

    fn open_stream(&self, path: &Path) -> Result<Box<dyn SourceStream>> {
        self.opaque_stream(path)
    }

    fn digest_unretained(&self, path: &Path) -> Result<String> {
        self.digest_file(path, true)
    }

    fn digest(&self, path: &Path) -> Result<String> {
        self.digest_file(path, false)
    }

    fn prefetch(&self, requested: &[PathBuf]) -> Result<()> {
        self.prefetch_sources(requested)
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
