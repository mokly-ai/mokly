//! Bind evidence to the selected source and dependency trees for one side.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_source_interface::error::Result;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::{identity_evidence, range_evidence};

use crate::sources::{SideTree, SourceOrigin};

impl SideTree {
    pub(crate) fn read_identity(&self, path: &Path) -> Result<Option<String>> {
        let (tree, physical, origin) = self.selected(path)?;
        if let Some(base) = &self._base
            && matches!(origin, SourceOrigin::Repository)
            && let Ok(relative) = physical.strip_prefix(&self.root)
        {
            return self
                .dependencies
                .file_object(&base.sources.directory.join(relative));
        }
        tree.file_object(&physical)
    }
    pub(crate) fn record_observations(
        &self,
        path: &Path,
        baselines: &BTreeSet<ReadBaseline>,
    ) -> Result<()> {
        let (tree, physical, origin) = self.selected(path)?;
        if let Some(base) = &self._base
            && matches!(origin, SourceOrigin::Repository)
            && let Ok(relative) = physical.strip_prefix(&self.root)
        {
            let digest = tree.digest(&physical)?;
            let ranges_valid = range_evidence::verify(tree, &physical, baselines, &digest);
            for baseline in baselines {
                let identity_valid = baseline.identity().is_none_or(|identity| {
                    identity_evidence::matches(
                        self.dependencies.as_ref(),
                        &base.sources.directory.join(relative),
                        identity,
                    )
                });
                let actual = if !identity_valid {
                    None
                } else {
                    match baseline.whole_digest() {
                        Some(_) => Some(digest.as_str()),
                        None => ranges_valid.then(|| baseline.digest()),
                    }
                };
                self.dependencies.observe_pinned_input(
                    &base.sources.directory.join(relative),
                    baseline,
                    actual,
                )?;
            }
            return Ok(());
        }
        tree.observe_inputs(&physical, baselines)
    }
}
