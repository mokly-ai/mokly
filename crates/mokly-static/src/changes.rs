//! Retained comparison state and publication identity at the static boundary.

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::output::upload::{BuildInventory, Comparison, Publication, UploadMetadata};
use mokly_model::public_metadata::ChangesStatus;

use crate::error::{InternalError, Result};

/// One completed Changes state, shared with the command's terminal summary.
pub trait ChangeState {
    /// Final availability, never preparing or pending.
    fn status(&self) -> ChangesStatus;
    /// Effective configured ref, absent only when disabled.
    fn base(&self) -> Option<&str>;
    /// Complete comparison and its pinned graph handles when ready.
    fn ready(&self) -> Option<&ComparisonResult>;
}

/// Publication context finalized after the comparison inventory is complete.
pub struct PublicationInput {
    /// Git identity pinned before rendering.
    pub identity: Publication,
    /// Configuration path relative to the publication repository.
    pub config_path: String,
    /// Exact UTC millisecond timestamp.
    pub exported_at: String,
}

impl PublicationInput {
    pub(crate) fn metadata(&self, changes: &dyn ChangeState) -> Result<UploadMetadata> {
        let comparison = changes.ready().map(|ready| Comparison {
            base_ref: ready.snapshot.base_ref.clone(),
            base_sha: ready.snapshot.base_commit.clone(),
        });
        match self.identity.metadata(&BuildInventory {
            config_path: self.config_path.clone(),
            exported_at: self.exported_at.clone(),
            comparison,
        }) {
            Ok(metadata) => Ok(metadata),
            Err(source) => Err(InternalError::Format { source }.into()),
        }
    }
}
