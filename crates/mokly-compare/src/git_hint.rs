//! A projection hint loads the metadata of many exact base paths with one lookup.

use std::collections::BTreeSet;
use std::path::PathBuf;

use mokly_git::identity::RepoPath;

use crate::git_tree::GitTree;

impl GitTree {
    /// Look up the exact paths that later projections ask for in one batched lookup,
    /// so that each projection finds its entry or its absence without a Git process.
    ///
    /// A path with a descendant in the set stays out: one Git listing of a directory
    /// and a path below it prints the directory's children in place of its own
    /// record. A failed lookup loads nothing and records no failure, so each later
    /// projection runs its own lookup and keeps its own error.
    pub(crate) fn hint_metadata(&self, paths: &[PathBuf]) {
        let requested: BTreeSet<RepoPath> = paths
            .iter()
            .filter_map(|path| self.relative(path).ok().flatten())
            .collect();
        let names: Vec<&str> = requested.iter().map(RepoPath::as_str).collect();
        let leaves: Vec<RepoPath> = requested
            .iter()
            .filter(|path| {
                let below = format!("{}/", path.as_str());
                let first = names.partition_point(|name| *name < below.as_str());
                !names
                    .get(first)
                    .is_some_and(|name| name.starts_with(below.as_str()))
            })
            .cloned()
            .collect();
        if leaves.len() < 2 {
            return;
        }
        if let Err(error) = self.sources.ensure(&leaves) {
            tracing::debug!(%error, "base projections look up their paths one at a time");
        }
    }
}

#[cfg(test)]
#[path = "_tests_/git_hint_tests.rs"]
mod git_hint_tests;
