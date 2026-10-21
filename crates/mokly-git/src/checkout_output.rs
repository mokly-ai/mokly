//! Decode bounded identity-conversion batches and classify conversion failures.

use crate::error::{Error, Result};
use crate::tree::{Entry, text};

pub(crate) fn decode_batch<'a>(
    mut output: &'a [u8],
    entries: &[Entry],
    limit: usize,
) -> Result<Vec<&'a [u8]>> {
    let mut result = Vec::with_capacity(entries.len());
    let mut total = 0usize;
    for entry in entries {
        let Some(end) = output.iter().position(|byte| *byte == 0) else {
            return Err(Error::MalformedOutput);
        };
        let fields = text(&output[..end])?
            .split_ascii_whitespace()
            .collect::<Vec<_>>();
        let [object, "blob", size] = fields.as_slice() else {
            return Err(Error::MalformedOutput);
        };
        if *object != entry.object.as_str() {
            return Err(Error::MalformedOutput);
        }
        let Ok(size) = size.parse::<usize>() else {
            return Err(Error::MalformedOutput);
        };
        if size != entry.size {
            return Err(Error::MalformedOutput);
        }
        total = total.saturating_add(size);
        if total > limit {
            return Err(Error::ByteLimit { limit });
        }
        output = &output[end + 1..];
        if output.len() <= size || output[size] != 0 {
            return Err(Error::MalformedOutput);
        }
        result.push(&output[..size]);
        output = &output[size + 1..];
    }
    if !output.is_empty() {
        return Err(Error::MalformedOutput);
    }
    Ok(result)
}

pub(crate) fn conversion<T>(result: Result<T>, entries: &[Entry]) -> Result<T> {
    match result {
        Err(
            source @ (Error::CheckoutTimeout
            | Error::CheckoutFailed { .. }
            | Error::CommandFailed { .. }
            | Error::ByteLimit { .. }
            | Error::OutputLimit { .. }),
        ) => Err(Error::Conversion {
            path: entries
                .first()
                .map_or(".", |entry| entry.path.as_str())
                .into(),
            source: Box::new(source),
        }),
        other => other,
    }
}

#[cfg(test)]
#[path = "_tests_/checkout_output_tests.rs"]
mod checkout_output_tests;
