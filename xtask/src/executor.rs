//! Pure executor mode parsing and flag precedence.

use clap::ValueEnum;

use crate::remote::error::{Error, Result};

/// Requested location for complete verification.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub(crate) enum Executor {
    /// Preserve local behavior until automatic selection is implemented.
    Auto,
    /// Execute suites sequentially in the local checkout.
    Local,
    /// Require complete remote verification.
    Remote,
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
