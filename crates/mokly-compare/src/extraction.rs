//! On-demand extraction of one commit through the shared source cache.

use std::path::Path;
use std::sync::Arc;

use mokly_git::identity::ObjectId;
use mokly_git::repository::Repository;
use mokly_git::tree::Limits;

use crate::cache_types::{Builder, Cache, Kind, Lease};
use crate::error::{GitResult, Result};

/// Base extraction API used only when JavaScript needs sources on disk.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ExtractionMock))]
pub trait Extraction: Send + Sync {
    /// Acquire a leased source root keyed by commit.
    fn acquire(&self, commit: &ObjectId) -> Result<Lease>;
}

/// Git source extraction coordinator.
pub struct CachedExtraction {
    /// Validated repository access.
    pub repository: Arc<dyn Repository>,
    /// Shared external cache.
    pub cache: Arc<dyn Cache>,
    /// Source archive budgets.
    pub limits: Limits,
}

struct Extract<'a> {
    repository: &'a dyn Repository,
    commit: &'a ObjectId,
    limits: Limits,
}

impl Builder for Extract<'_> {
    fn build(&self, destination: &Path) -> Result<()> {
        self.repository
            .extract(self.commit, destination, self.limits)
            .base()
    }
}

impl Extraction for CachedExtraction {
    fn acquire(&self, commit: &ObjectId) -> Result<Lease> {
        self.cache.get(
            Kind::Sources,
            commit.as_str(),
            &Extract {
                repository: self.repository.as_ref(),
                commit,
                limits: self.limits,
            },
        )
    }
}
