//! The whole current stamp of a tree, the reference that the stamp tests compare with.

use mokly_source_interface::tree::SourceTree;

use crate::input_stamp::InputStamp;
use crate::postcss_scan::Scan;

use super::{directory_files, membership};

impl InputStamp {
    /// The stamp that `tree` gives for the keys of this stamp. It names every field, so a new
    /// field does not compile until the reference reads it.
    pub(crate) fn current(&self, tree: &dyn SourceTree) -> Self {
        let Self {
            memberships,
            files,
            unretained,
            projections,
            assets,
            identities,
            directories,
        } = self;
        let mut result = Self::default();
        for path in memberships.keys() {
            result
                .memberships
                .insert(path.clone(), membership(tree, path));
        }
        for path in files.keys() {
            result.file(tree, path.clone());
        }
        for path in unretained.keys() {
            result
                .unretained
                .insert(path.clone(), tree.digest_unretained(path).ok());
        }
        for path in projections.keys() {
            result
                .projections
                .insert(path.clone(), tree.project(path).ok());
        }
        for path in assets.keys() {
            result.asset(tree, path.clone());
        }
        for path in identities.keys() {
            result.identity(tree, path.clone());
        }
        let mut scan = Scan::default();
        for (path, pattern) in directories.keys() {
            let files = directory_files(&mut scan, tree, path, pattern);
            result
                .directories
                .insert((path.clone(), pattern.clone()), files);
        }
        result
    }
}
