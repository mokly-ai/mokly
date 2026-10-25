//! Content digests and directory membership validate cached stylesheet recipes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_css::dependencies::DirectoryDependency;
use mokly_source_interface::tree::{FileKind, Node, SourceTree};

use crate::error::RenderError;
use crate::postcss_scan::Scan;

#[derive(Clone, Default, PartialEq, Eq)]
pub(crate) struct InputStamp {
    pub(crate) memberships: BTreeMap<PathBuf, Option<BTreeSet<PathBuf>>>,
    pub(crate) files: BTreeMap<PathBuf, Option<String>>,
    pub(crate) assets: BTreeMap<PathBuf, Option<(Node, String)>>,
    pub(crate) identities: BTreeMap<PathBuf, Option<(Node, String)>>,
    pub(crate) directories: BTreeMap<(PathBuf, String), Option<Vec<PathBuf>>>,
}

impl InputStamp {
    pub(crate) fn retained_bytes(&self) -> usize {
        let files: usize = self
            .files
            .iter()
            .map(|(path, digest)| {
                path.capacity()
                    + digest.as_ref().map_or(0, String::capacity)
                    + size_of_val(path)
                    + size_of_val(digest)
            })
            .sum();
        let directories: usize = self
            .directories
            .iter()
            .map(|((path, glob), files)| {
                path.capacity()
                    + glob.capacity()
                    + size_of_val(path)
                    + size_of_val(glob)
                    + files.as_ref().map_or(0, |files| {
                        files.capacity() * size_of::<PathBuf>()
                            + files.iter().map(|path| path.capacity()).sum::<usize>()
                    })
            })
            .sum();
        let memberships: usize = self
            .memberships
            .iter()
            .map(|(path, names)| {
                path.capacity()
                    + names.as_ref().map_or(0, |names| {
                        names
                            .iter()
                            .map(|name| size_of_val(name) + name.capacity())
                            .sum::<usize>()
                    })
            })
            .sum();
        let assets: usize = self
            .assets
            .iter()
            .chain(self.identities.iter())
            .map(|(path, stamp)| {
                path.capacity()
                    + size_of_val(stamp)
                    + stamp
                        .as_ref()
                        .map_or(0, |(node, hash)| node.identity.capacity() + hash.capacity())
            })
            .sum();
        (files + directories + memberships + assets).saturating_mul(2)
    }

    pub(crate) fn file(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let hash = tree.digest(&path).ok();
        self.files.insert(path, hash);
    }

    pub(crate) fn asset(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let stamp = tree.project(&path).ok().flatten().and_then(|node| {
            tree.digest_unretained(&node.identity)
                .ok()
                .map(|hash| (node, hash))
        });
        self.assets.insert(path, stamp);
    }

    pub(crate) fn identity(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let value = tree.project(&path).ok().flatten().and_then(|node| {
            tree.file_object(&path)
                .ok()
                .flatten()
                .map(|object| (node, object))
        });
        self.identities.insert(path, value);
    }

    pub(crate) fn directories(
        &mut self,
        tree: &dyn SourceTree,
        root: &Path,
        directories: &[DirectoryDependency],
    ) {
        let mut scan = Scan::default();
        for directory in directories {
            let path = root.join(&directory.path);
            let files = scan
                .matching_files(tree, &path, &directory.glob, &|| RenderError::ResultKind {
                    method: "dependency glob",
                })
                .ok()
                .map(|files| files.to_vec());
            self.directories
                .insert((path, directory.glob.clone()), files);
        }
    }

    pub(crate) fn current(&self, tree: &dyn SourceTree) -> Self {
        let mut result = Self::default();
        for path in self.memberships.keys() {
            let names = tree.children(path).ok().map(|children| {
                children
                    .into_iter()
                    .filter(|child| matches!(child.kind, FileKind::File | FileKind::Symlink))
                    .map(|child| PathBuf::from(child.name))
                    .collect()
            });
            result.memberships.insert(path.clone(), names);
        }
        for path in self.files.keys() {
            result.file(tree, path.clone());
        }
        for path in self.assets.keys() {
            result.asset(tree, path.clone());
        }
        for path in self.identities.keys() {
            result.identity(tree, path.clone());
        }
        let mut scan = Scan::default();
        for (path, pattern) in self.directories.keys() {
            let files = scan
                .matching_files(tree, path, pattern, &|| RenderError::ResultKind {
                    method: "dependency glob",
                })
                .ok()
                .map(|files| files.to_vec());
            result
                .directories
                .insert((path.clone(), pattern.clone()), files);
        }
        result
    }
}

#[cfg(test)]
#[path = "_tests_/asset_stamp_tests.rs"]
mod asset_stamp_tests;
