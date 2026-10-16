//! Compiled glob recipes and shared directory denials.

use std::path::{Path, PathBuf};

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

use crate::error::{InternalError, Result};

pub(crate) fn compile(patterns: &[String]) -> Result<GlobSet> {
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        match GlobBuilder::new(pattern)
            .literal_separator(true)
            .backslash_escape(false)
            .build()
        {
            Ok(glob) => {
                builder.add(glob);
            }
            Err(source) => return Err(InternalError::Glob { source }.into()),
        }
    }
    match builder.build() {
        Ok(patterns) => Ok(patterns),
        Err(source) => Err(InternalError::Glob { source }.into()),
    }
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

pub(crate) const DEFAULT_GLOBS: [&str; 7] = [
    "**/*.mockup.{ts,tsx}",
    "**/*.stories.{ts,tsx,js,jsx}",
    "**/*.screen.html",
    "**/*.component.html",
    "**/*.page.html",
    "**/*.use-case.yaml",
    "**/*.md",
];
