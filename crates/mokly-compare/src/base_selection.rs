//! One pinned repository and reference shared by admission and comparison.

use std::path::Path;
use std::sync::Arc;

use mokly_git::identity::ObjectId;
use mokly_git::repository::{Repositories, Repository};

use crate::error::{GitResult, Result};

/// Immutable base selection, retained after the output directory is admitted.
#[derive(Clone)]
pub struct PinnedBase {
    /// Selected authored reference.
    pub reference: String,
    /// Repository used for source reads and extraction.
    pub repository: Arc<dyn Repository>,
    /// Merge base resolved exactly once.
    pub commit: ObjectId,
}

/// Git lookup boundary, separate from current-side validation and rendering.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BaseLookupMock))]
pub trait BaseLookup: Send + Sync {
    /// Resolve and retain a base before starting current rendering.
    fn pin(&self, root: &Path, reference: &str) -> Result<Arc<PinnedBase>>;
}

/// Native repository lookup with one timing span and one Git failure.
pub struct GitBaseLookup {
    /// Git factory supplied by the command composition root.
    pub repositories: Arc<dyn Repositories>,
}
impl BaseLookup for GitBaseLookup {
    fn pin(&self, root: &Path, reference: &str) -> Result<Arc<PinnedBase>> {
        let span = tracing::info_span!("review.base-commit", status = "error");
        let _entered = span.enter();
        let repository = self.repositories.open(root).base()?;
        let commit = repository.merge_base(reference).base()?;
        span.record("status", "ok");
        Ok(Arc::new(PinnedBase {
            reference: reference.into(),
            repository,
            commit,
        }))
    }
}

#[cfg(test)]
#[path = "_tests_/base_selection_tests.rs"]
mod base_selection_tests;
