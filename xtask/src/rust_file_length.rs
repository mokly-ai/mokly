//! Rust source file-length audit.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{Error, FilesystemResult, Result};

const MAX_LINES: usize = 300;

/// Audits Rust source length for repository checks.
#[cfg_attr(test, unimock::unimock(api = [RustFileLengthAuditorRunMock]))]
pub(crate) trait RustFileLengthAuditor: Send + Sync {
    /// Audit all Rust files beneath `xtask` and an optional `crates` directory.
    fn run(&self, workspace: &Path) -> Result<()>;
}

/// Operating-system implementation of the Rust source audit.
pub(crate) struct SystemRustFileLengthAuditor;

impl RustFileLengthAuditor for SystemRustFileLengthAuditor {
    fn run(&self, workspace: &Path) -> Result<()> {
        let mut files = Vec::new();
        collect_rust_files(&workspace.join("xtask"), &mut files)?;
        let crates = workspace.join("crates");
        if crates.exists() {
            collect_rust_files(&crates, &mut files)?;
        }
        files.sort();
        let violations = files
            .iter()
            .filter_map(|file| line_violation(workspace, file).transpose())
            .collect::<Result<Vec<_>>>()?;
        if violations.is_empty() {
            eprintln!("Rust file-length audit passed for {} file(s).", files.len());
            return Ok(());
        }
        Err(Error::RustFileLength {
            details: violations.join("\n"),
        })
    }
}

fn collect_rust_files(root: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let root_display = root.display().to_string();
    let entries = fs::read_dir(root).with_filesystem_context("read directory", &root_display)?;
    for entry in entries {
        let entry = entry.with_filesystem_context("read directory entry", &root_display)?;
        let path = entry.path();
        if path.is_dir() {
            collect_rust_files(&path, files)?;
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            files.push(path);
        }
    }
    Ok(())
}

fn line_violation(workspace: &Path, file: &Path) -> Result<Option<String>> {
    let display = file.display().to_string();
    let source = fs::read_to_string(file).with_filesystem_context("read file", &display)?;
    let lines = source.lines().count();
    Ok((lines > MAX_LINES).then(|| {
        let relative = match file.strip_prefix(workspace) {
            Ok(relative) => relative,
            Err(_) => file,
        };
        format!("{}: {lines} lines", relative.display())
    }))
}
