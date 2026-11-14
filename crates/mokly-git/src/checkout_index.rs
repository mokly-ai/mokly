//! A scoped object inventory includes requested leaves and their attribute ancestors.

use std::collections::{BTreeMap, BTreeSet};

use crate::error::Result;
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, Limits};

impl GitRepository {
    fn checkout_entries(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<BTreeMap<RepoPath, Entry>> {
        let attrs = self.lookup_metadata(
            commit,
            &attribute_paths(entries.iter().map(|entry| &entry.path))?,
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
}

/// Attribute ancestors shared by exact lookups and conversion preflight.
pub(crate) fn attribute_paths<'a>(
    paths: impl Iterator<Item = &'a RepoPath>,
) -> Result<Vec<RepoPath>> {
    let mut attributes = BTreeSet::from([RepoPath::parse(".gitattributes")?]);
    for path in paths {
        let mut parent = path.as_str();
        while let Some((directory, _)) = parent.rsplit_once('/') {
            attributes.insert(RepoPath::parse(&format!("{directory}/.gitattributes"))?);
            parent = directory;
        }
    }
    Ok(attributes.into_iter().collect())
}
