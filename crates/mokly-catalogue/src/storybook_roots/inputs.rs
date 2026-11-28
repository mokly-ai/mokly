//! Configuration input witnesses of one Storybook folder.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_source_interface::read_evidence::ReadEvidence;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::relative;

/// Whole-file witnesses and absent candidates of Storybook configuration.
#[derive(Debug, Default, PartialEq)]
pub struct StorybookInputs {
    /// All distinct contents observed for each file name.
    pub versions: ReadEvidence,
    /// Absence remains observable even if another load found the same file.
    pub absent: BTreeSet<String>,
}

impl StorybookInputs {
    pub(super) fn with_projected_aliases(mut self, tree: &dyn SourceTree, root: &Path) -> Self {
        let projected: Vec<_> = self
            .versions
            .inputs
            .iter()
            .filter_map(|(path, versions)| {
                let node = tree.project(&root.join(path)).ok().flatten()?;
                if node.kind != FileKind::File || !node.identity.starts_with(root) {
                    return None;
                }
                let name = relative(&node.identity, root);
                (name != *path).then(|| (name, versions.clone()))
            })
            .collect();
        for (name, versions) in projected {
            self.versions
                .inputs
                .entry(name)
                .or_default()
                .extend(versions);
        }
        self
    }
}
