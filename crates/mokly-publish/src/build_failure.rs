//! Typed handoff for errors owned by the static output implementation.

use std::error;

/// Stable categories that a static build can preserve through publication.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Category {
    /// Catalogue validation or rendering failed.
    BuildInvalid,
    /// Invalid configuration.
    ConfigInvalid,
    /// Configuration discovery found no configuration.
    ConfigMissing,
    /// Output transaction or recovery failed, with paths needed for recovery.
    ExportInvalid,
    /// Git history or revision resolution failed.
    GitFailed,
    /// Comparison preparation failed.
    ReviewInvalid,
}

/// A static builder returns its own typed error through this boundary.
/// Recovery errors keep their category even when command cancellation also occurred.
/// Only an explicitly classified standalone cancellation uses Error::Cancelled.
pub trait BuildFailure: error::Error + Send + Sync {
    /// Preserve the originating build error category.
    fn category(&self) -> Category;
    /// Preserve safe recovery details; the terminal still redacts credentials and controls.
    fn detail(&self) -> String;
}
