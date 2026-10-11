//! Pure process outcome conversion and cleanup diagnostic selection.

use crate::remote::contracts::Output;
use crate::remote::error::{Error, Operation, Result};

/// Convert process termination into a typed boundary failure.
pub(in crate::remote) fn success(output: &Output, operation: Operation) -> Result<()> {
    command_result(output, operation, None)
}

/// Retain a bounded cleanup diagnostic from already redacted process output.
pub(super) fn cleanup_success(output: &Output, operation: Operation) -> Result<()> {
    let detail = [&output.stderr, &output.stdout]
        .into_iter()
        .find_map(|stream| {
            stream
                .lines()
                .rev()
                .map(str::trim)
                .find(|line| !line.is_empty())
        })
        .map(|line| line.chars().take(200).collect());
    command_result(output, operation, detail)
}

/// Keep the typed command constructor shared without changing ordinary failures.
fn command_result(output: &Output, operation: Operation, detail: Option<String>) -> Result<()> {
    if output.success() {
        Ok(())
    } else {
        Err(Error::Command {
            operation,
            code: output.code,
            detail,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/cleanup_detail_tests.rs"]
mod cleanup_detail_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/cleanup_detail_process_adapter_tests.rs"]
mod cleanup_detail_process_adapter_tests;
