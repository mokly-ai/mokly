//! A scoped object inventory includes requested leaves and their attribute ancestors.

use std::collections::{BTreeMap, BTreeSet};

use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits};

impl GitRepository {
    fn checkout_entries(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<BTreeMap<RepoPath, Entry>> {
        let mut attributes = BTreeSet::new();
        attributes.insert(RepoPath::parse(".gitattributes")?);
        for entry in entries {
            let mut parent = entry.path.as_str();
            while let Some((directory, _)) = parent.rsplit_once('/') {
                attributes.insert(RepoPath::parse(&format!("{directory}/.gitattributes"))?);
                parent = directory;
            }
        }
        let attrs = self.lookup_metadata(
            commit,
            &attributes.into_iter().collect::<Vec<_>>(),
            Limits::default(),
            false,
        )?;
        let mut indexed: BTreeMap<_, _> = attrs
            .into_iter()
            .filter(|entry| entry.mode.regular())
            .map(|entry| (entry.path.clone(), entry))
            .collect();
        indexed.extend(
            entries
                .iter()
                .cloned()
                .map(|entry| (entry.path.clone(), entry)),
        );
        Ok(indexed)
    }

    /// The whole-tree listing of `commit` for its checkout settings. Git prints the size of
    /// a listed blob only when the object store holds it. So when each blob record has a
    /// decimal size, the object check of the listed files and their attribute files can
    /// find nothing missing, and it does not run. Any other size, such as `BAD` for a
    /// missing blob, runs the check as `Repository::list` does.
    pub(crate) fn settings_listing(&self, commit: &ObjectId) -> Result<Vec<Entry>> {
        let request = self.tree_request(&[
            "ls-tree",
            "-r",
            "-t",
            "-l",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ]);
        let listing = self.initial_tree_listing(&request)?;
        let entries = tree::parse(&listing, Limits::default())?;
        if tree::sizes_every_blob(&listing) {
            return Ok(entries);
        }
        if self.ensure_checkout_objects(commit, &entries)? || !self.promisor_remotes.is_empty() {
            return tree::parse(&self.runner.run(&request)?.stdout, Limits::default());
        }
        Ok(entries)
    }

    pub(crate) fn ensure_checkout_objects(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<bool> {
        if entries.is_empty() {
            return Ok(false);
        }
        self.ensure_objects(
            commit,
            &self
                .checkout_entries(commit, entries)?
                .into_values()
                .collect::<Vec<_>>(),
        )
    }
}
