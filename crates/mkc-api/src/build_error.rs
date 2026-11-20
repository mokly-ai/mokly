//! Public refusals for cloud build requests and the project setting.

use thiserror::Error;

use crate::error_data::{ActiveBuild, BuildIneligible, PublishedBuild};

/// Build reasons delegated by the API's sole HTTP error contract.
#[derive(Debug, Error, rpc_error::RpcError)]
pub enum BuildError {
    /// Publish this project from CI.
    #[error("[mkc-api/build_error] builds unavailable")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "builds-unavailable",
        message = "Publish this project from CI."
    )]
    Unavailable,
    /// Publish this pull request from CI.
    #[error("[mkc-api/build_error] build ineligible")]
    #[rpc_error(
        code = "failed-precondition",
        severity = "warn",
        reason = "build-ineligible",
        message = "Publish this pull request from CI."
    )]
    Ineligible(BuildIneligible),
    /// Open the build already in progress.
    #[error("[mkc-api/build_error] build already active")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "build-already-active",
        message = "Open the build already in progress."
    )]
    AlreadyActive(ActiveBuild),
    /// Open the published catalogue.
    #[error("[mkc-api/build_error] build already published")]
    #[rpc_error(
        code = "already-exists",
        severity = "warn",
        reason = "build-already-published",
        message = "Open the published catalogue."
    )]
    AlreadyPublished(PublishedBuild),
}
