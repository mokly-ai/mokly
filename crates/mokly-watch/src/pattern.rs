//! Compiled glob recipes and shared directory denials.

use std::path::{Path, PathBuf};

use globset::GlobSet;
use mokly_catalogue::globs::{self, GlobSyntax};

use crate::error::Result;

pub(crate) fn compile(patterns: &[String], syntax: GlobSyntax) -> Result<GlobSet> {
    Ok(globs::compile(patterns, syntax)?)
}

pub(crate) fn denied(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "coverage"
            | "target"
            | "test-results"
            | "playwright-report"
            | ".context"
    )
}

pub(crate) fn rule_root(root: &Path, pattern: &str) -> PathBuf {
    let mut path = root.to_owned();
    let mut parts = pattern.split('/').peekable();
    while let Some(part) = parts.next() {
        if parts.peek().is_none() || part.contains(['*', '?', '{', '[']) {
            break;
        }
        path.push(part);
    }
    path
}
