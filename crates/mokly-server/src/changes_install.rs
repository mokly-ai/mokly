//! Install ready metadata after expensive projection and before its public pointer.

use std::collections::BTreeMap;
use std::sync::Arc;

use crate::assets::File;
use crate::changes::Accepted;
use crate::comparison_store::Comparisons;
use crate::error::Result;

/// A short metadata installation that precedes the atomic ready-state swap.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeInstallationMock))]
pub trait ChangeInstallation: Send + Sync {
    /// Install immutable metadata or leave the public state unpublished on failure.
    fn install(&self) -> Result<()>;
}

/// Bytes prepared by the background classifier, with their retained source owner.
pub(crate) struct MetadataInstallation<'a> {
    /// The process's immutable generation store.
    pub(crate) store: &'a dyn Comparisons,
    /// The classification that the next index will advertise.
    pub(crate) accepted: &'a Arc<Accepted>,
    /// Canonical metadata without snapshot documents.
    pub(crate) files: &'a BTreeMap<String, File>,
}

impl ChangeInstallation for MetadataInstallation<'_> {
    fn install(&self) -> Result<()> {
        self.store
            .install(self.accepted.clone(), self.files.clone())
    }
}
