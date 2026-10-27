//! The changed-file source and protocol length audit.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use super::caps::{CAP_TABLE, ProtocolCaps, parse_cap_table};
use super::error::{Error, Result};
use super::git::GitWorkspace;
use super::policy::{is_audited_path, length_finding};

/// Audits the length of changed TypeScript, JavaScript, and protocol files.
#[cfg_attr(test, unimock::unimock(api = [SourceFileLengthAuditorRunMock]))]
pub(crate) trait SourceFileLengthAuditor: Send + Sync {
    /// Audit the checkout that contains `start`: the files changed against
    /// `origin/main`, or every tracked and untracked file with `all`.
    fn run(&self, start: &Path, all: bool) -> Result<()>;
}

/// The Git and file-system implementation of the length audit.
pub(crate) struct SystemSourceFileLengthAuditor;

impl SourceFileLengthAuditor for SystemSourceFileLengthAuditor {
    fn run(&self, start: &Path, all: bool) -> Result<()> {
        let git = GitWorkspace::open(start)?;
        let root = git.root();
        let caps = working_tree_caps(root)?;
        let files: Vec<String> = if all {
            git.current_files()?
        } else {
            git.changed_files(&["."])?
                .into_iter()
                .map(|change| change.path)
                .collect()
        };
        let audited: BTreeSet<&String> =
            files.iter().filter(|file| is_audited_path(file)).collect();
        let mut violations = Vec::new();
        for file in audited {
            let absolute = root.join(file);
            if !absolute.is_file() {
                continue;
            }
            let source = read(&absolute)?;
            violations.extend(length_finding(file, &source, &caps));
        }
        if !violations.is_empty() {
            return Err(Error::SourceFileLength {
                details: violations.join("\n"),
            });
        }
        println!(
            "Source file-length audit passed for {} file(s).",
            files.len()
        );
        Ok(())
    }
}

/// The working tree's cap table, or no caps when the file is absent.
fn working_tree_caps(root: &Path) -> Result<ProtocolCaps> {
    let file = root.join(CAP_TABLE);
    if !file.exists() {
        return Ok(ProtocolCaps::default());
    }
    parse_cap_table(&read(&file)?, CAP_TABLE)
}

fn read(file: &Path) -> Result<Vec<u8>> {
    match fs::read(file) {
        Ok(bytes) => Ok(bytes),
        Err(source) => Err(Error::Filesystem {
            operation: "read",
            path: file.display().to_string(),
            source,
        }),
    }
}

#[cfg(test)]
#[path = "_tests_/source_audit_tests.rs"]
mod source_audit_tests;
