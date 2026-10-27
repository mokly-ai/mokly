//! One generation classifies dependency paths once and retains digests, never file bytes.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use globset::GlobBuilder;

use mokly_source_interface::tree::{Child, FileKind, Node, SourceTree};

use crate::error::{InternalError, RenderError, Result};

#[derive(Default)]
pub(crate) struct Scan {
    nodes: BTreeMap<PathBuf, Option<Node>>,
    directories: BTreeMap<PathBuf, Vec<Child>>,
    digests: BTreeMap<PathBuf, String>,
    matches: BTreeMap<(PathBuf, String), Arc<[PathBuf]>>,
    pub(crate) classifications: usize,
}

impl Scan {
    pub(crate) fn project(&mut self, tree: &dyn SourceTree, path: &Path) -> Result<Option<Node>> {
        if !self.nodes.contains_key(path) {
            let node = match tree.project(path) {
                Ok(node) => node,
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            self.nodes.insert(path.into(), node);
        }
        Ok(self.nodes.get(path).cloned().flatten())
    }

    pub(crate) fn children(&mut self, tree: &dyn SourceTree, path: &Path) -> Result<Vec<Child>> {
        if !self.directories.contains_key(path) {
            let children = match tree.children(path) {
                Ok(children) => children,
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            self.directories.insert(path.into(), children);
        }
        Ok(self.directories.get(path).cloned().unwrap_or_default())
    }

    pub(crate) fn digest(&mut self, tree: &dyn SourceTree, path: &Path) -> Result<String> {
        if let Some(digest) = self.digests.get(path) {
            return Ok(digest.clone());
        }
        let value = match tree.digest(path) {
            Ok(value) => value,
            Err(source) => return Err(InternalError::Source { source }.into()),
        };
        self.digests.insert(path.into(), value.clone());
        Ok(value)
    }

    /// List the files below `root` that match a directory dependency glob, cached per pair.
    /// The glob keeps `*` in one path segment and turns off backslash escaping on every
    /// platform, because globset's default for it differs between Unix and Windows.
    pub(crate) fn matching_files(
        &mut self,
        tree: &dyn SourceTree,
        root: &Path,
        pattern: &str,
        invalid: &dyn Fn() -> RenderError,
    ) -> Result<Arc<[PathBuf]>> {
        let key = (root.to_owned(), pattern.to_owned());
        if let Some(files) = self.matches.get(&key) {
            return Ok(files.clone());
        }
        let matcher = match GlobBuilder::new(pattern)
            .literal_separator(true)
            .backslash_escape(false)
            .build()
        {
            Ok(glob) => glob.compile_matcher(),
            Err(_) => return Err(invalid()),
        };
        let mut files = Vec::new();
        let mut pending = vec![(root.to_owned(), PathBuf::new())];
        while let Some((directory, suffix)) = pending.pop() {
            for child in self.children(tree, &directory)? {
                self.classifications += 1;
                let suffix = suffix.join(&child.name);
                if child.kind == FileKind::Directory && !denied(&child.name) {
                    pending.push((root.join(&suffix), suffix));
                } else if child.kind == FileKind::File && matcher.is_match(&suffix) {
                    files.push(suffix);
                }
            }
        }
        let files: Arc<[PathBuf]> = files.into();
        self.matches.insert(key, files.clone());
        Ok(files)
    }

    pub(crate) fn retained_bytes(&self) -> usize {
        let nodes = self
            .nodes
            .iter()
            .map(|(path, node)| {
                path.capacity()
                    + size_of::<(PathBuf, Option<Node>)>()
                    + node.as_ref().map_or(0, |node| node.identity.capacity())
            })
            .sum::<usize>();
        let directories = self
            .directories
            .iter()
            .map(|(path, children)| {
                path.capacity()
                    + size_of::<(PathBuf, Vec<Child>)>()
                    + children.capacity() * size_of::<Child>()
                    + children
                        .iter()
                        .map(|child| child.name.capacity())
                        .sum::<usize>()
            })
            .sum::<usize>();
        let digests = self
            .digests
            .iter()
            .map(|(path, digest)| {
                path.capacity() + digest.capacity() + size_of::<(PathBuf, String)>()
            })
            .sum::<usize>();
        let matches = self
            .matches
            .iter()
            .map(|((root, pattern), files)| {
                size_of::<((PathBuf, String), Arc<[PathBuf]>)>()
                    + root.capacity()
                    + pattern.capacity()
                    + std::mem::size_of_val(files.as_ref())
                    + files.iter().map(|path| path.capacity()).sum::<usize>()
            })
            .sum::<usize>();
        size_of::<Self>() + nodes + directories + digests + matches
    }
}

fn denied(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "coverage"
            | "target"
            | "test-results"
            | "playwright-report"
            | ".context"
    )
}
