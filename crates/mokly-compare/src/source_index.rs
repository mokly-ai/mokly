//! The loaded part of one commit's tree index: exact paths and expanded roots.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_git::identity::RepoPath;

use crate::sources::TreeIndex;

#[derive(Default)]
pub(crate) struct SourceIndex {
    pub(crate) index: Arc<TreeIndex>,
    pub(crate) known: BTreeSet<RepoPath>,
    pub(crate) roots: Vec<Option<RepoPath>>,
}

impl SourceIndex {
    pub(crate) fn covered(&self, path: &RepoPath) -> bool {
        self.roots
            .iter()
            .any(|root| root.as_ref().is_none_or(|root| path.under(root)))
    }
}
