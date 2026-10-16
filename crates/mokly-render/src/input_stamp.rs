//! Content digests and directory membership validate cached stylesheet recipes.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_css::dependencies::DirectoryDependency;
use mokly_source_interface::tree::SourceTree;

use crate::error::RenderError;
use crate::postcss_scan::Scan;

#[derive(Clone, Default, PartialEq, Eq)]
pub(crate) struct InputStamp {
    pub(crate) files: BTreeMap<PathBuf, Option<String>>,
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
        (files + directories).saturating_mul(2)
    }

    pub(crate) fn file(&mut self, tree: &dyn SourceTree, path: PathBuf) {
        let hash = tree.digest(&path).ok();
        self.files.insert(path, hash);
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
        for path in self.files.keys() {
            result.file(tree, path.clone());
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
