//! Optional eager pinning leaves authoritative review timing to current classification.

use std::path::Path;
use std::sync::Arc;

use mokly_compare::base_selection::{BaseLookup, PinnedBase};
use mokly_compare::error::{Error, Result};
use mokly_git::error;
use mokly_git::repository::Repositories;

/// The source phase uses the tracked Git boundary without an authoritative review span.
pub(super) struct EagerLookup {
    pub(super) repositories: Arc<dyn Repositories>,
}

impl BaseLookup for EagerLookup {
    fn pin(&self, root: &Path, reference: &str) -> Result<Arc<PinnedBase>> {
        let repository = match self.repositories.open(root) {
            Ok(repository) => repository,
            Err(error::Error::Cancelled) => return Err(Error::Cancelled),
            Err(source) => return Err(Error::Git { source }),
        };
        let commit = match repository.merge_base(reference) {
            Ok(commit) => commit,
            Err(error::Error::Cancelled) => return Err(Error::Cancelled),
            Err(source) => return Err(Error::Git { source }),
        };
        Ok(Arc::new(PinnedBase {
            reference: reference.into(),
            repository,
            commit,
        }))
    }
}
