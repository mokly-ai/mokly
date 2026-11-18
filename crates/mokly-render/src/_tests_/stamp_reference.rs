//! The whole current stamp of a tree, the reference that the stamp tests compare with.

use mokly_source_interface::tree::SourceTree;

use crate::input_stamp::InputStamp;
use crate::postcss_scan::Scan;

use super::{directory_files, membership};

impl InputStamp {
    /// The stamp that `tree` gives for the keys of this stamp.
    pub(crate) fn current(&self, tree: &dyn SourceTree) -> Self {
        let mut result = Self::default();
        for path in self.memberships.keys() {
            result
                .memberships
                .insert(path.clone(), membership(tree, path));
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
            let files = directory_files(&mut scan, tree, path, pattern);
            result
                .directories
                .insert((path.clone(), pattern.clone()), files);
        }
        result
    }
}
