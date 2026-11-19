//! A scoped object inventory includes requested leaves and their attribute ancestors.

use std::collections::{BTreeMap, BTreeSet};

use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::source_key::KeptListing;
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

    /// List the leaves below `root`, or the whole tree, after the object check of the
    /// listed files and their attribute files. A listing equal to the listing that `kept`
    /// holds for `commit` passed that check already, so it skips the check. A listing that
    /// passes the check goes into `kept`.
    pub(crate) fn listing(
        &self,
        commit: &ObjectId,
        root: Option<&RepoPath>,
        limits: Limits,
        kept: Option<&dyn KeptListing>,
    ) -> Result<Vec<Entry>> {
        let mut args = vec![
            "ls-tree",
            "-r",
            "-t",
            "-l",
            "-z",
            "--full-tree",
            commit.as_str(),
            "--",
        ];
        if let Some(root) = root {
            args.push(root.as_str());
        }
        let request = self.tree_request(&args);
        let mut listing = self.runner.run(&request)?.stdout;
        let mut entries = tree::parse(&listing, limits)?;
        if kept.is_some_and(|kept| kept.matches(commit, &listing)) {
            return Ok(entries);
        }
        if self.ensure_checkout_objects(commit, &entries)? {
            listing = self.runner.run(&request)?.stdout;
            entries = tree::parse(&listing, limits)?;
        }
        if let Some(kept) = kept {
            kept.keep(commit, &listing);
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
            &self
                .checkout_entries(commit, entries)?
                .into_values()
                .collect::<Vec<_>>(),
        )
    }
}
