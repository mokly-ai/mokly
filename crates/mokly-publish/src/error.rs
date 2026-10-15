//! Safe, typed publication failures. Network details never enter this contract.

use std::path::PathBuf;

use mokly_git::error;
use thiserror::Error;

use crate::build_failure::BuildFailure;

/// Publication result.
pub type Result<T> = std::result::Result<T, Error>;

/// Failures that the command can classify without inspecting error text.
#[derive(Debug, Error)]
pub enum Error {
    /// The finalized output violates the public upload contract.
    #[error(
        "[mokly-publish/upload-invalid-bundle] The catalogue upload is invalid. Rebuild the catalogue and retry."
    )]
    InvalidBundle,
    /// A documented upload ceiling was exceeded.
    #[error(
        "[mokly-publish/upload-too-large] The catalogue is too large to publish. Reduce the output size or raise the receiver limit."
    )]
    TooLarge,
    /// The receiver or inventory uses another version.
    #[error(
        "[mokly-publish/upload-unsupported-version] The catalogue service does not support this Mokly version. Update the service and try again."
    )]
    UnsupportedVersion,
    /// The receiver rejected credentials or access.
    #[error(
        "[mokly-publish/upload-unauthorized] The catalogue upload was not authorized. Check the token and repository access."
    )]
    Unauthorized,
    /// A response violates the exchange, or the one re-plan was exhausted.
    #[error(
        "[mokly-publish/upload-failed] The catalogue could not be published. Check the endpoint and connection, then retry."
    )]
    Failed,
    /// Requests exhausted their retry budget.
    #[error(
        "[mokly-publish/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry."
    )]
    Transport,
    /// This operation detected and acted on command cancellation.
    #[error(
        "[mokly-publish/upload-failed] Publication was cancelled. Run mokly publish again when you are ready."
    )]
    Cancelled,
    /// The active exchange needs the command's one fresh Plan.
    #[error("[mokly-publish/upload-failed] The upload expired or is incomplete.")]
    Replan,
    /// Invalid configured Plan URL.
    #[error(
        "[mokly-publish/cli-invalid] publish endpoint must be an HTTP(S) URL without credentials or a fragment"
    )]
    Endpoint,
    /// Invalid bearer-token grammar.
    #[error("[mokly-publish/cli-invalid] publish token must use the bearer-token grammar")]
    Token,
    /// Invalid parallel request bound.
    #[error("[mokly-publish/cli-invalid] upload concurrency must be an integer from 1 through 32")]
    Concurrency,
    /// Git failed without a cancellation classification.
    #[error(
        "[mokly-publish/git-failed] Git information could not be read. Check the repository and configured base."
    )]
    Git {
        /// Typed bounded Git failure; never print its captured stderr.
        source: error::Error,
    },
    /// Git output is absent, malformed, or not a committed checkout.
    #[error("[mokly-publish/git-failed] Publish requires a Git checkout with a committed HEAD.")]
    Checkout,
    /// Repository metadata could not identify one remote repository.
    #[error(
        "[mokly-publish/git-failed] The repository could not be identified. Set --repository to host/owner/name."
    )]
    Repository,
    /// Publication requires a clean checkout.
    #[error("[mokly-publish/git-uncommitted] The checkout has uncommitted changes.")]
    Uncommitted {
        /// All unique repository-relative changed paths, sorted for display.
        paths: Vec<String>,
        /// The final check detected changes after rendering.
        during_build: bool,
        /// Known output folders for literal Git ignore guidance.
        build_directories: Vec<String>,
    },
    /// A concurrent checkout changed the revision during rendering.
    #[error("[mokly-publish/git-failed] HEAD changed during the build. Run mokly publish again.")]
    HeadChanged,
    /// The static builder is an explicit later milestone boundary.
    #[error("[mokly-publish/build-invalid] Static output is not available in this build.")]
    StaticUnavailable,
    /// An error owned by the static output transaction retains its category.
    #[error("[mokly-publish/build] {failure}")]
    Build {
        /// Original typed build or recovery error.
        failure: Box<dyn BuildFailure>,
    },
    /// The selected warning policy refused publication.
    #[error(
        "[mokly-publish/build-invalid] The catalogue has build warnings. Fix the reported warnings and retry."
    )]
    BuildWarnings,
    /// Safe failures inside adapters retain their source for code inspection.
    #[error(
        "[mokly-publish/upload-failed] The catalogue could not be prepared for publication. Rebuild the catalogue and retry."
    )]
    Internal(#[from] InternalError),
}

/// Adapter failures. Display intentionally contains no source text or secrets.
#[derive(Debug, Error)]
pub enum InternalError {
    /// A pure archive operation failed.
    #[error("archive preparation failed")]
    Archive {
        /// Original source, for typed inspection only.
        source: std::io::Error,
    },
    /// A private output directory could not be reserved.
    #[error("private build directory preparation failed")]
    Directory {
        /// Original source, for typed inspection only.
        source: std::io::Error,
    },
    /// The operating system selected an in-repository temporary directory.
    #[error("private build directory must be outside the repository")]
    DirectoryInsideRepository {
        /// The candidate retained for code inspection.
        directory: PathBuf,
    },
}
