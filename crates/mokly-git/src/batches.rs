//! Bounded ordered batching above the injected Git runner.

use std::ffi::OsString;
use std::path::Path;
use std::sync::Arc;

use crate::command::{DEFAULT_OUTPUT_LIMIT, Output, Request, Runner};
use crate::error::{Error, Result};

/// Default maximum path arguments per Git invocation.
pub const MAX_ARGUMENTS: usize = 128;
/// Conservative cross-platform encoded argument budget.
pub const MAX_ARGUMENT_BYTES: usize = 16 * 1024;

/// Bounded multi-command execution boundary.
pub trait Batches: Send + Sync {
    /// Run ordered path batches; stop at the first failed invocation.
    fn run(&self, directory: &Path, prefix: &[OsString], paths: &[OsString])
    -> Result<Vec<Output>>;
}

/// Batch coordinator with configurable count and byte limits.
pub struct BoundedRunner {
    /// Injected subprocess implementation.
    pub runner: Arc<dyn Runner>,
    /// Maximum paths in each invocation.
    pub max_arguments: usize,
    /// Maximum encoded bytes including prefix arguments and separators.
    pub max_bytes: usize,
}

impl Batches for BoundedRunner {
    fn run(
        &self,
        directory: &Path,
        prefix: &[OsString],
        paths: &[OsString],
    ) -> Result<Vec<Output>> {
        let batches = split(prefix, paths, self.max_arguments, self.max_bytes)?;
        let mut outputs = Vec::with_capacity(batches.len());
        for args in batches {
            outputs.push(self.runner.run(&Request {
                directory: directory.to_owned(),
                args,
                output_limit: DEFAULT_OUTPUT_LIMIT,
            })?);
        }
        Ok(outputs)
    }
}

/// Split arguments by count and conservative UTF-16/UTF-8 byte costs.
/// An empty path list issues no command, so no empty batch broadens a query.
pub fn split(
    prefix: &[OsString],
    paths: &[OsString],
    count: usize,
    bytes: usize,
) -> Result<Vec<Vec<OsString>>> {
    if count == 0 || bytes == 0 {
        return Err(Error::InvalidBudget);
    }
    let cost = |argument: &OsString| {
        argument
            .as_encoded_bytes()
            .len()
            .saturating_mul(2)
            .saturating_add(2)
    };
    let base = prefix.iter().map(cost).fold(0usize, usize::saturating_add);
    if base > bytes {
        return Err(Error::ArgumentLimit { limit: bytes });
    }
    let mut batches = Vec::new();
    let mut batch = prefix.to_vec();
    let mut used = base;
    for path in paths {
        let size = cost(path);
        if size > bytes - base {
            return Err(Error::ArgumentLimit { limit: bytes });
        }
        if batch.len() - prefix.len() == count || used + size > bytes {
            batches.push(batch);
            batch = prefix.to_vec();
            used = base;
        }
        batch.push(path.clone());
        used += size;
    }
    if batch.len() > prefix.len() {
        batches.push(batch);
    }
    Ok(batches)
}

#[cfg(test)]
#[path = "_tests_/batches_tests.rs"]
mod batches_tests;
