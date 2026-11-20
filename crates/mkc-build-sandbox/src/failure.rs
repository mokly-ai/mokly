//! Safe failure facts with no provider, sink or caller-controlled text.

use mkc_build_interface::error;
use mkc_build_interface::outcome::BuildOutcome;
use thiserror::Error;

/// Safe facts for infrastructure outcomes and cleanup warnings.
#[derive(Debug, Error)]
pub(crate) enum Failure {
    #[error("[mkc-build-sandbox/failure] invalid deployment identity")]
    Deployment,
    #[error("[mkc-build-sandbox/failure] credential overlaps process arguments")]
    CredentialInArgument,
    #[error("[mkc-build-sandbox/failure] sandbox create failed")]
    Create,
    #[error("[mkc-build-sandbox/failure] sandbox create could not be recovered")]
    Recovery,
    #[error("[mkc-build-sandbox/failure] sandbox destroy failed")]
    Destroy,
    #[error("[mkc-build-sandbox/failure] credential file write failed")]
    Write,
    #[error("[mkc-build-sandbox/failure] log sink failed")]
    Sink,
    #[error("[mkc-build-sandbox/failure] log sink exhausted its delivery budget")]
    SinkBackpressure,
    #[error("[mkc-build-sandbox/failure] process transport failed")]
    Transport,
    #[error("[mkc-build-sandbox/failure] process consumer backpressure")]
    Backpressure,
    #[error("[mkc-build-sandbox/failure] Yarn version was not SemVer")]
    YarnVersion,
    #[error("[mkc-build-sandbox/failure] Tokio runtime is required")]
    Runtime,
}

impl Failure {
    pub(crate) fn outcome(self) -> BuildOutcome {
        BuildOutcome::Infrastructure(error::Error::internal(self).into_internal())
    }
}
