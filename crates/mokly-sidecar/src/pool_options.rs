//! Pure pool sizing and deadline policy from the command's environment snapshot.

use std::path::PathBuf;

use crate::error::{Error, Result};

/// Process launch settings supplied by the binary's composition root.
#[derive(Clone, Debug)]
pub struct Launch {
    /// Node executable, resolved through the inherited PATH when relative.
    pub node: PathBuf,
    /// Installed package's dist/sidecar.js.
    pub entry: PathBuf,
    /// Repository root used as the child working directory.
    pub repository: PathBuf,
    /// Exact package version expected by hello.
    pub version: String,
}

/// Captured environment fields; no ambient reads occur in policy code.
#[derive(Default)]
pub struct Environment {
    /// MOKLY_SIDECARS.
    pub sidecars: Option<String>,
    /// MOKLY_SIDECAR_TIMEOUT_MS.
    pub timeout_ms: Option<String>,
}

/// Maximum concurrency and optional common request deadline.
#[derive(Clone, Debug)]
pub struct PoolOptions {
    /// Any positive process count; processes start only when needed.
    pub size: usize,
    /// Environment override for the method's default deadline.
    pub timeout_ms: Option<u64>,
}

impl PoolOptions {
    /// Resolve CLI precedence over environment and the supplied core count.
    pub fn resolve(cli: Option<&str>, environment: &Environment, cores: usize) -> Result<Self> {
        let size = match cli.or(environment.sidecars.as_deref()) {
            Some(value) => positive("sidecars", value)?,
            None => cores.max(1),
        };
        let timeout_ms = match environment.timeout_ms.as_deref() {
            Some(value) => Some(positive("MOKLY_SIDECAR_TIMEOUT_MS", value)? as u64),
            None => None,
        };
        Ok(Self { size, timeout_ms })
    }
}

fn positive(setting: &'static str, value: &str) -> Result<usize> {
    if !value.is_empty()
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && let Ok(number) = value.parse::<usize>()
        && number > 0
    {
        return Ok(number);
    }
    Err(Error::InvalidSetting {
        setting,
        value: value.to_owned(),
    })
}

#[cfg(test)]
#[path = "_tests_/pool_options_tests.rs"]
mod pool_options_tests;
