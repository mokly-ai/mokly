//! Pure executor mode parsing and flag precedence.

use std::fmt;

use clap::ValueEnum;

use crate::remote::error::{Error, Result};

/// Requested location for complete verification.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum Executor {
    /// Select remote verification when every availability condition passes.
    Auto,
    /// Execute suites sequentially in the local checkout.
    Local,
    /// Require complete remote verification.
    Remote,
}

/// Why the complete gate uses the local checkout.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum LocalReason {
    /// Explicit local mode.
    Requested,
    /// A partial suite always stays local.
    Suite,
    /// Hosted GitHub workflow.
    GithubActions,
    /// No org key was supplied for automatic selection.
    NoKey,
    /// A required program is unavailable.
    Program,
    /// CLI version lookup failed.
    Version,
    /// Org-key login failed.
    Login,
    /// Testbox list access failed.
    Access,
    /// Origin reachability failed.
    Published,
    /// A box preparation phase failed before any suite.
    Preparation,
}

/// One availability decision with a stable, single-line explanation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Decision {
    /// Run the full local gate.
    Local(LocalReason),
    /// Remote availability checks passed.
    Remote,
}

impl fmt::Display for Decision {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let reason = match self {
            Self::Remote => {
                return formatter
                    .write_str("remote: Blacksmith access and pushed HEAD are available");
            }
            Self::Local(reason) => match reason {
                LocalReason::Requested => "local mode was requested",
                LocalReason::Suite => "a selected suite runs locally",
                LocalReason::GithubActions => "GitHub Actions requires local verification",
                LocalReason::NoKey => "BLACKSMITH_ORG_TOKEN is empty or unset",
                LocalReason::Program => "a required executable is unavailable",
                LocalReason::Version => "Blacksmith version lookup failed",
                LocalReason::Login => "Blacksmith key login failed",
                LocalReason::Access => "Blacksmith Testbox access failed",
                LocalReason::Published => "local HEAD is not reachable from origin refs",
                LocalReason::Preparation => "remote preparation failed before any suite started",
            },
        };
        write!(formatter, "local: {reason}")
    }
}

/// Resolve the effective mode without reading ambient state.
pub(crate) fn resolve_executor(
    flag: Option<Executor>,
    environment: Option<&str>,
) -> Result<Executor> {
    if let Some(flag) = flag {
        return Ok(flag);
    }
    match environment {
        None | Some("auto") => Ok(Executor::Auto),
        Some("local") => Ok(Executor::Local),
        Some("remote") => Ok(Executor::Remote),
        Some(value) => Err(Error::InvalidExecutor {
            value: value.to_owned(),
        }),
    }
}
