//! Safe relative POSIX glob validation and matching.

use std::collections::BTreeSet;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

use crate::config_types::ResolvedRoot;

mod pattern;
mod validation;

/// Default source selection, independent of application layout.
const DEFAULT_GLOBS: [&str; 7] = [
    "**/*.mockup.{ts,tsx}",
    "**/*.stories.{ts,tsx,js,jsx}",
    "**/*.screen.html",
    "**/*.component.html",
    "**/*.page.html",
    "**/*.use-case.yaml",
    "**/*.md",
];

/// The source of a pattern determines its syntax and path checks.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum GlobSyntax {
    /// Configured root, folder exclusion, or watch rule.
    Posix,
    /// Pattern from a Storybook `stories` entry.
    Storybook,
    /// Glob supplied by a PostCSS directory dependency.
    Postcss,
}

/// Errors in the pattern list, its alternatives, or the compiled matcher.
#[derive(Debug, thiserror::Error)]
pub enum GlobError {
    /// The list names the same pattern twice.
    #[error("duplicate glob {0:?}")]
    Duplicate(String),
    /// A pattern or alternative is an unsafe relative path.
    #[error("not a safe relative POSIX glob: {0:?}")]
    Unsafe(String),
    /// A brace group is missing its closing brace.
    #[error("unclosed brace in glob {0:?}")]
    UnclosedBrace(String),
    /// Storybook uses an extglob operator outside Mokly's subset.
    #[error("unsupported extglob {0}(...)")]
    UnsupportedExtglob(char),
    /// A Storybook group is missing its closing parenthesis.
    #[error("unclosed extglob")]
    UnclosedExtglob,
    /// A Storybook group cannot be expressed with glob alternatives.
    #[error("unsupported Storybook group in glob {0:?}")]
    UnsupportedGroup(String),
    /// Globset rejected the pattern.
    #[error("invalid glob {pattern:?}: {source}")]
    Pattern {
        /// The authored pattern.
        pattern: String,
        /// The parser error.
        source: globset::Error,
    },
    /// Globset could not build the set of patterns.
    #[error("invalid globs: {0}")]
    Set(#[from] globset::Error),
}

/// Compile grouped globs and check relative path alternatives without expansion.
/// `*` stays in one path segment and backslash escaping is off on every platform.
pub fn compile(patterns: &[impl AsRef<str>], syntax: GlobSyntax) -> Result<GlobSet, GlobError> {
    let mut builder = GlobSetBuilder::new();
    let mut seen = BTreeSet::new();
    for pattern in patterns {
        let pattern = pattern.as_ref();
        if !seen.insert(pattern) {
            return Err(GlobError::Duplicate(pattern.into()));
        }
        if syntax != GlobSyntax::Postcss {
            validate(pattern)?;
        }
        let grouped = if syntax == GlobSyntax::Storybook && pattern.contains('(') {
            Some(pattern::compile_groups(pattern, true)?)
        } else {
            if syntax != GlobSyntax::Postcss && pattern.contains('{') {
                pattern::compile_groups(pattern, false)?;
            }
            None
        };
        let glob = match GlobBuilder::new(grouped.as_deref().unwrap_or(pattern))
            .literal_separator(true)
            .backslash_escape(false)
            .empty_alternates(grouped.is_some())
            .build()
        {
            Ok(glob) => glob,
            Err(source) => {
                return Err(GlobError::Pattern {
                    pattern: pattern.into(),
                    source,
                });
            }
        };
        builder.add(glob);
    }
    Ok(builder.build()?)
}

/// Compile one effective root with the syntax of its configured source.
pub fn for_root(root: &ResolvedRoot) -> Result<GlobSet, GlobError> {
    let syntax = if root.from_storybook_main() {
        GlobSyntax::Storybook
    } else {
        GlobSyntax::Posix
    };
    match &root.input.files {
        Some(patterns) => compile(patterns, syntax),
        None => compile(&DEFAULT_GLOBS, syntax),
    }
}

fn validate(pattern: &str) -> Result<(), GlobError> {
    if pattern.trim().is_empty()
        || pattern.starts_with(['!', '#', '/'])
        || pattern
            .chars()
            .any(|c| c == '\\' || c == ':' || c.is_control())
        || pattern
            .split('/')
            .any(|segment| matches!(segment, "" | "." | ".."))
    {
        return Err(GlobError::Unsafe(pattern.into()));
    }
    Ok(())
}

/// Discovery directory denials apply below each explicit root only.
pub(crate) fn denied_directory(name: &str) -> bool {
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

#[cfg(test)]
#[path = "_tests_/globs_tests.rs"]
mod globs_tests;
