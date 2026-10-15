//! Parsed concurrency and launch settings from the composition root.

use std::num::NonZeroUsize;
use std::path::PathBuf;

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

/// Maximum concurrency and optional common request deadline.
#[derive(Clone, Debug)]
pub struct PoolOptions {
    /// Any positive process count; processes start only when needed.
    pub size: NonZeroUsize,
    /// Environment override for the method's default deadline.
    pub timeout_ms: Option<u64>,
}

#[cfg(test)]
#[path = "_tests_/pool_options_tests.rs"]
mod pool_options_tests;
