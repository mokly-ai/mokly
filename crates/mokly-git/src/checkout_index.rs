//! A scoped object inventory includes requested leaves and their attribute ancestors.

use std::collections::BTreeMap;

use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::presence::attribute_paths;
use crate::repository::GitRepository;
use crate::tree::{self, Entry, Limits, Mode};

impl GitRepository {
    fn checkout_entries(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<BTreeMap<RepoPath, Entry>> {
        let paths: Vec<_> = entries.iter().map(|entry| entry.path.clone()).collect();
        let attributes = attribute_paths(&paths)?;
        let attrs = self.lookup_metadata(
            commit,
            &attributes.into_iter().collect::<Vec<_>>(),
            Limits::default(),
            false,
            true,
        )?;
        let mut indexed: BTreeMap<_, _> = attrs
            .into_iter()
            .filter(|entry| entry.mode.regular() || entry.mode == Mode::Directory)
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
        if self.whole_listing_proves(&listing, Limits::default()) {
            return Ok(entries);
        }
        if self.fetch_checkout_objects(commit, &entries)? || !self.promisor_remotes.is_empty() {
            return tree::parse(&self.runner.run(&request)?.stdout, Limits::default());
        }
        Ok(entries)
    }

    /// Whether a sized whole-tree listing, which holds every attribute file of the
    /// commit, proves each listed blob present: each blob record has a decimal size.
    /// The listing must also fit the default bounds that the attribute listing of
    /// the missing-object walk applies, so skipping that walk loses no bound error.
    pub(crate) fn whole_listing_proves(&self, listing: &[u8], limits: Limits) -> bool {
        let bounds = Limits::default();
        self.promisor_remotes.is_empty()
            && limits.files <= bounds.files
            && limits.nodes <= bounds.nodes
            && tree::sizes_every_blob(listing)
    }

    /// Makes each blob of `entries` and of their attribute files present before a
    /// conversion reads them. Without a promisor remote, one sized listing of the
    /// entries and their attribute files usually proves them present, so the
    /// missing-object walk does not run. Returns whether a fetch ran.
    pub(crate) fn ensure_checkout_objects(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<bool> {
        if entries.is_empty() {
            return Ok(false);
        }
        let paths: Vec<_> = entries.iter().map(|entry| entry.path.clone()).collect();
        if self
            .presence(commit, &["-l"], &paths)
            .is_some_and(|presence| presence.holds(entries))
        {
            return Ok(false);
        }
        self.fetch_checkout_objects(commit, entries)
    }

    /// Lists the attribute files of `entries`, finds each missing blob with one
    /// lazy-fetch-free walk, and fetches the missing set from a promisor remote.
    /// A caller whose own sized listing could not prove its entries present calls
    /// this directly. Returns whether a fetch ran.
    pub(crate) fn fetch_checkout_objects(
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
