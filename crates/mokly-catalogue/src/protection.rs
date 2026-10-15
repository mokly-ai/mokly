//! Shared private-source classification, including candidates and physical aliases.

use std::collections::BTreeSet;

use globset::GlobSet;

use crate::config::relative;
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::error::Result;
use crate::globs::{self, DEFAULT_GLOBS};

/// The first source-protection cause in the protocol's precedence order.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProtectedBy {
    /// A configured root's source glob, even before discovery or after exclusion.
    RootMatch {
        /// Configured root index.
        root: usize,
    },
    /// Reserved source basename, independently of imports.
    ReservedBasename,
    /// A validated source-inventory input or its physical alias.
    ListedInput,
}

/// Pure, reusable source classifier. Consumers must also confine and stat their read.
pub struct SourcePolicy {
    roots: Vec<RootMatch>,
    sources: BTreeSet<String>,
}

struct RootMatch {
    lexical: String,
    physical: String,
    globs: GlobSet,
}

impl SourcePolicy {
    /// Compile each root once and index the complete private source set.
    pub fn new(config: &ResolvedConfig, sources: &[String]) -> Result<Self> {
        let mut roots = Vec::new();
        for (index, root) in config.roots.iter().enumerate() {
            let patterns = root
                .input
                .files
                .clone()
                .unwrap_or_else(|| DEFAULT_GLOBS.iter().map(|s| (*s).into()).collect());
            let globs = match globs::compile(&patterns) {
                Ok(globs) => globs,
                Err(reason) => return Err(invalid(format!("roots[{index}].files: {reason}"))),
            };
            roots.push(RootMatch {
                lexical: relative(&root.directory, &config.repo_root),
                physical: relative(&root.identity, &config.repo_root),
                globs,
            });
        }
        Ok(Self {
            roots,
            sources: sources.iter().cloned().collect(),
        })
    }

    /// Classify both the requested path and its resolved in-repository alias.
    pub fn denial(&self, requested: &str, resolved: Option<&str>) -> Option<ProtectedBy> {
        let paths: Vec<_> = std::iter::once(requested).chain(resolved).collect();
        for (index, root) in self.roots.iter().enumerate() {
            for path in &paths {
                if [&root.lexical, &root.physical].iter().any(|directory| {
                    let relative = if directory.is_empty() {
                        Some(*path)
                    } else {
                        path.strip_prefix(directory.as_str())
                            .and_then(|rest| rest.strip_prefix('/'))
                    };
                    relative.is_some_and(|relative| root.globs.is_match(relative))
                }) {
                    return Some(ProtectedBy::RootMatch { root: index });
                }
            }
        }
        if paths.iter().any(|path| is_reserved_source(path)) {
            return Some(ProtectedBy::ReservedBasename);
        }
        if paths.iter().any(|path| self.sources.contains(*path)) {
            return Some(ProtectedBy::ListedInput);
        }
        None
    }
}

/// Check a reserved source basename independently of discovery or imports.
pub fn is_reserved_source(path: &str) -> bool {
    let basename = path.rsplit('/').next().unwrap_or(path).to_ascii_lowercase();
    basename == "_folder.json"
        || [
            "html", "htm", "ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs",
        ]
        .iter()
        .any(|extension| basename.ends_with(&format!(".source.{extension}")))
}

#[cfg(test)]
#[path = "_tests_/protection_tests.rs"]
mod protection_tests;
