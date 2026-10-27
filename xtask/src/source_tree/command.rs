//! `cargo xtask source-tree`: print the fingerprint of the checkout, check
//! an expected value, and print `HEAD` for the Testbox readiness probe.

use std::io::{self, Write};
use std::path::Path;

use clap::Args;

use super::error::{Error, Result};
use super::records::{SourceFingerprint, lowercase_hex};
use super::scan::read_source_tree;
use super::system::{SystemTree, TreeSystem};

/// One `cargo xtask source-tree` request, parsed from its arguments.
#[derive(Args, Clone, Debug, Eq, PartialEq)]
pub(crate) struct SourceTreeRequest {
    /// Fail unless the fingerprint equals this value.
    #[arg(
        long = "expect",
        value_name = "FINGERPRINT",
        value_parser = SourceFingerprint::parse
    )]
    pub(crate) expected: Option<SourceFingerprint>,
    /// Print the checkout's HEAD after the fingerprint.
    #[arg(long)]
    pub(crate) print_head: bool,
}

/// Prints the fingerprint of a checkout.
#[cfg_attr(test, unimock::unimock(api = [SourceTreeCommandRunMock]))]
pub(crate) trait SourceTreeCommand: Send + Sync {
    /// Print the fingerprint of `root`, and its `HEAD` when requested.
    fn run(&self, root: &Path, request: &SourceTreeRequest) -> Result<()>;
}

/// The command over the real checkout and standard output.
pub(crate) struct SystemSourceTreeCommand;

impl SourceTreeCommand for SystemSourceTreeCommand {
    fn run(&self, root: &Path, request: &SourceTreeRequest) -> Result<()> {
        let output = source_tree_output(&SystemTree, root, request)?;
        write_output(&output, &mut io::stdout().lock())
    }
}

/// Write the command output to `target` and flush it.
fn write_output(output: &str, target: &mut dyn Write) -> Result<()> {
    match target
        .write_all(output.as_bytes())
        .and_then(|()| target.flush())
    {
        Ok(()) => Ok(()),
        Err(source) => Err(Error::Output { source }),
    }
}

/// The command output: the fingerprint line, then the `HEAD` line when the
/// request asks for it.
pub(crate) fn source_tree_output(
    system: &dyn TreeSystem,
    root: &Path,
    request: &SourceTreeRequest,
) -> Result<String> {
    let actual = read_source_tree(system, root)?;
    if let Some(expected) = &request.expected
        && *expected != actual
    {
        return Err(Error::Mismatch {
            expected: expected.to_string(),
            actual: actual.to_string(),
        });
    }
    let mut output = format!("{actual}\n");
    if request.print_head {
        let head = String::from_utf8_lossy(&system.head(root)?)
            .trim()
            .to_owned();
        if !lowercase_hex(&head, 40) {
            return Err(Error::Head);
        }
        output.push_str(&head);
        output.push('\n');
    }
    Ok(output)
}

#[cfg(test)]
#[path = "_tests_/command_tests.rs"]
mod command_tests;
