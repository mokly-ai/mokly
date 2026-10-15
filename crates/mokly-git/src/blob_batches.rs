//! Exact framed-output and object-count budgets for cat-file requests.

use std::ops::Range;

use crate::error::{Error, Result};
use crate::tree::Entry;

pub(crate) const BYTES: usize = 48 * 1024 * 1024;
pub(crate) const COUNT: usize = 4096;

pub(crate) fn cost(entry: &Entry) -> usize {
    entry
        .size
        .saturating_add(entry.object.as_str().len())
        .saturating_add(entry.size.to_string().len())
        .saturating_add(8)
}

pub(crate) fn split(entries: &[Entry], bytes: usize, count: usize) -> Result<Vec<Range<usize>>> {
    if bytes == 0 || count == 0 {
        return Err(Error::InvalidBudget);
    }
    let mut result = Vec::new();
    let mut start = 0;
    let mut used = 0usize;
    for (index, entry) in entries.iter().enumerate() {
        let cost = cost(entry);
        if cost > bytes {
            return Err(Error::ByteLimit { limit: bytes });
        }
        if index - start == count || used.saturating_add(cost) > bytes {
            result.push(start..index);
            start = index;
            used = 0;
        }
        used += cost;
    }
    if start < entries.len() {
        result.push(start..entries.len());
    }
    Ok(result)
}

#[cfg(test)]
#[path = "_tests_/blob_batches_tests.rs"]
mod blob_batches_tests;
