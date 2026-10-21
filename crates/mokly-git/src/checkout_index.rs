//! A private checkout index contains requested leaves and their attribute ancestors only.

use std::collections::{BTreeMap, BTreeSet};

use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits, Mode};

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

    pub(crate) fn checkout_index(&self, commit: &ObjectId, entries: &[Entry]) -> Result<Vec<u8>> {
        let indexed = self.checkout_entries(commit, entries)?;
        self.ensure_objects(&indexed.values().cloned().collect::<Vec<_>>())?;
        let mut input = Vec::new();
        for entry in indexed.values() {
            let mode = if entry.mode == Mode::Executable {
                "100755"
            } else {
                "100644"
            };
            input
                .extend_from_slice(format!("{mode} {}\t{}\0", entry.object, entry.path).as_bytes());
        }
        Ok(input)
    }
}
