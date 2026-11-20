//! Watch-only candidates retain admission boundaries and advisory projection results.

use std::path::PathBuf;

use mokly_source_interface::error::{Result, SourceError};

#[derive(Eq, Ord, PartialEq, PartialOrd)]
pub(crate) struct Candidate {
    pub(crate) path: PathBuf,
    pub(crate) dependency_root: Option<PathBuf>,
}

/// Optional projections preserve cancellation while failed alternatives retain repair paths.
pub(crate) fn optional<T>(result: Result<T>) -> Result<Option<T>> {
    match result {
        Ok(value) => Ok(Some(value)),
        Err(error @ SourceError::Cancelled { .. }) => Err(error),
        Err(_) => Ok(None),
    }
}
