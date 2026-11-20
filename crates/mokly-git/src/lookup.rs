//! Exact tree metadata batches and streamed immutable blob hashes.

use std::ffi::OsString;

use crate::batches::{self, MAX_ARGUMENT_BYTES, MAX_ARGUMENTS};
use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits};

impl GitRepository {
    pub(crate) fn lookup_paths(
        &self,
        commit: &ObjectId,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Vec<Entry>> {
        let entries = self.lookup_metadata(commit, paths, limits, false)?;
        if self.ensure_checkout_objects(commit, &entries)? || !self.promisor_remotes.is_empty() {
            return self.lookup_metadata(commit, paths, limits, true);
        }
        Ok(entries)
    }

    pub(crate) fn lookup_metadata(
        &self,
        commit: &ObjectId,
        paths: &[RepoPath],
        limits: Limits,
        with_sizes: bool,
    ) -> Result<Vec<Entry>> {
        let mut request =
            self.tree_request(&["ls-tree", "-l", "-z", "--full-tree", commit.as_str(), "--"]);
        let paths: Vec<_> = paths
            .iter()
            .map(|path| OsString::from(path.as_str()))
            .collect();
        let mut entries = Vec::new();
        for args in batches::split(&request.args, &paths, MAX_ARGUMENTS, MAX_ARGUMENT_BYTES)? {
            request.args = args;
            let output = if with_sizes {
                self.runner.run(&request)?.stdout
            } else {
                self.initial_tree_listing(&request)?
            };
            entries.extend(tree::parse(&output, limits)?);
        }
        Ok(entries)
    }
}
