//! Bounded ordered batching above the injected Git runner.

use std::ffi::OsString;

use crate::error::{Error, Result};

/// Default maximum path arguments per Git invocation.
pub const MAX_ARGUMENTS: usize = 128;
/// Conservative cross-platform encoded argument budget.
pub const MAX_ARGUMENT_BYTES: usize = 16 * 1024;

/// Split arguments by count and conservative UTF-16/UTF-8 byte costs.
/// An empty path list issues no command, so no empty batch broadens a query.
pub fn split(
    prefix: &[OsString],
    paths: &[OsString],
    count: usize,
    bytes: usize,
) -> Result<Vec<Vec<OsString>>> {
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
