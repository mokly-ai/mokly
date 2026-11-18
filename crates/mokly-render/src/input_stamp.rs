//! Content digests and directory membership validate cached stylesheet recipes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_css::dependencies::DirectoryDependency;
use mokly_source_interface::tree::{FileKind, Node, SourceTree};

use crate::postcss_scan::{Scan, glob};

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
        let hash = file_digest(tree, &path);
        self.files.insert(path, hash);
    }

    pub(crate) fn asset(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let stamp = asset_stamp(tree, &path);
        self.assets.insert(path, stamp);
    }

    pub(crate) fn identity(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let value = file_identity(tree, &path);
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
            let files = directory_files(&mut scan, tree, &path, &directory.glob);
            self.directories
                .insert((path, directory.glob.clone()), files);
        }
    }

    /// Whether `tree` still gives the recorded value of every entry. A failed read gives
    /// `None`, so an entry that stays unreadable still matches. The check reads repository
    /// files first, then the files below `node_modules`, the memberships, the assets, the
    /// identities, and the directory scans. It stops at the first entry that differs, so the
    /// order changes only the number of reads.
    pub(crate) fn matches(&self, tree: &dyn SourceTree) -> bool {
        let Self {
            memberships,
            files,
            assets,
            identities,
            directories,
        } = self;
        let file = |(path, digest): (&PathBuf, &Option<String>)| file_digest(tree, path) == *digest;
        let mut scan = Scan::default();
        files.iter().filter(|(path, _)| !dependency(path)).all(file)
            && files.iter().filter(|(path, _)| dependency(path)).all(file)
            && memberships
                .iter()
                .all(|(path, names)| membership(tree, path) == *names)
            && assets
                .iter()
                .all(|(path, stamp)| asset_stamp(tree, path) == *stamp)
            && identities
                .iter()
                .all(|(path, value)| file_identity(tree, path) == *value)
            && directories.iter().all(|((path, pattern), found)| {
                directory_files(&mut scan, tree, path, pattern) == *found
            })
    }
}

/// Whether a path has a `node_modules` component. `InputStamp::matches` reads these files
/// after the other files.
fn dependency(path: &Path) -> bool {
    path.components()
        .any(|component| component.as_os_str() == "node_modules")
}

fn file_digest(tree: &dyn SourceTree, path: &Path) -> Option<String> {
    tree.digest(path).ok()
}

fn asset_stamp(tree: &dyn SourceTree, path: &Path) -> Option<(Node, String)> {
    tree.project(path).ok().flatten().and_then(|node| {
        tree.digest_unretained(&node.identity)
            .ok()
            .map(|hash| (node, hash))
    })
}

fn file_identity(tree: &dyn SourceTree, path: &Path) -> Option<(Node, String)> {
    tree.project(path).ok().flatten().and_then(|node| {
        tree.file_object(path)
            .ok()
            .flatten()
            .map(|object| (node, object))
    })
}

/// The names of the files and symbolic links directly in a directory.
fn membership(tree: &dyn SourceTree, path: &Path) -> Option<BTreeSet<PathBuf>> {
    tree.children(path).ok().map(|children| {
        children
            .into_iter()
            .filter(|child| matches!(child.kind, FileKind::File | FileKind::Symlink))
            .map(|child| PathBuf::from(child.name))
            .collect()
    })
}

/// The files below `path` that match a retained directory dependency glob.
fn directory_files(
    scan: &mut Scan,
    tree: &dyn SourceTree,
    path: &Path,
    pattern: &str,
) -> Option<Vec<PathBuf>> {
    scan.matching_files(tree, path, pattern, &|| {
        Ok(glob(pattern).expect("retained PostCSS directory globs passed dependency validation"))
    })
    .ok()
    .map(|files| files.to_vec())
}

#[cfg(test)]
#[path = "_tests_/asset_stamp_tests.rs"]
mod asset_stamp_tests;

#[cfg(test)]
#[path = "_tests_/stamp_match_tests.rs"]
mod stamp_match_tests;

#[cfg(test)]
#[path = "_tests_/stamp_reference.rs"]
mod stamp_reference;
