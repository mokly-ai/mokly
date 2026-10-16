//! CLI-owned publication orchestration errors, separate from the upload exchange.

use std::path::PathBuf;

use mokly_publish::error;
use thiserror::Error;

use crate::publication::failure::BuildFailure;

/// End-to-end publish command result.
pub type Result<T> = std::result::Result<T, Error>;

/// Local build and checkout failures preserve their categories through publication.
#[derive(Debug, Error)]
pub enum Error {
    /// A signal arrived during a failed pre-build checkout operation.
    #[error("[mokly-cli/publication] {source}")]
    Interrupted {
        /// Original failure retained for optional diagnostics.
        source: error::Error,
    },
    /// An exchange, checkout adapter, or upload preparation failure.
    #[error("[mokly-cli/publication] {source}")]
    Exchange {
        /// Typed upload-layer cause.
        source: error::Error,
    },
    /// Publication requires a clean checkout.
    #[error("[mokly-cli/publication/git-uncommitted] The checkout has uncommitted changes.")]
    Uncommitted {
        /// All unique repository-relative changed paths, sorted for display.
        paths: Vec<String>,
        /// The final check detected changes after rendering.
        during_build: bool,
        /// Known output folders for literal Git ignore guidance.
        build_directories: Vec<String>,
    },
    /// A concurrent checkout changed the revision during rendering.
    #[error(
        "[mokly-cli/publication/git-failed] HEAD changed during the build. Run mokly publish again."
    )]
    HeadChanged,
    /// An error owned by the static output transaction retains its category.
    #[error("[mokly-cli/publication/build] {failure}")]
    Build {
        /// Original typed build or recovery error.
        failure: Box<dyn BuildFailure>,
    },
    /// The selected warning policy refused publication.
    #[error(
        "[mokly-cli/publication/build-invalid] The catalogue has build warnings. Fix the reported warnings and retry."
    )]
    BuildWarnings,
    /// Private output allocation failed before the static builder started.
    #[error(
        "[mokly-cli/publication/export-invalid] Unable to prepare temporary output at {temporary_root:?}. Set TMPDIR, or TMP on Windows, to a writable directory outside the checkout."
    )]
    Directory {
        /// Normalized temporary root, safe to show after terminal redaction.
        temporary_root: PathBuf,
        /// Typed reason; raw operating system messages are never printed.
        reason: DirectoryFailure,
    },
}

/// Private-directory failures preserve their reason without exposing raw I/O text.
#[derive(Debug, Error)]
pub enum DirectoryFailure {
    /// The selected temporary root is inside the checkout.
    #[error("[mokly-cli/publication/directory] temporary root is inside the checkout")]
    InsideRepository,
    /// The temporary directory could not be resolved or allocated.
    #[error("[mokly-cli/publication/directory] temporary root is unavailable")]
    Unavailable {
        /// Original operating-system failure, for typed inspection only.
        source: std::io::Error,
    },
}

/// Translate a publish-crate boundary without string matching.
pub trait ExchangeResult<T> {
    /// Preserve its typed cause at the CLI boundary.
    fn publication(self) -> Result<T>;
}
impl<T> ExchangeResult<T> for error::Result<T> {
    fn publication(self) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Exchange { source }),
        }
    }
}
