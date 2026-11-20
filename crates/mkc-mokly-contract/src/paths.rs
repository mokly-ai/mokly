//! Pure path validation and Unicode-aware archive namespace checks.

use std::collections::BTreeMap;

use sha2::{Digest, Sha256};

use crate::error::{Error, Limit, Rejection, Result, invalid};
use crate::limits::Limits;

pub(crate) fn validate(path: &str, limits: Limits) -> Result<()> {
    if path.len() > limits.path() {
        return Err(Error::TooLarge { limit: Limit::Path });
    }
    if path.split('/').count() > limits.path_segments() {
        return Err(Error::TooLarge {
            limit: Limit::PathSegments,
        });
    }
    if path.is_empty()
        || path
            .chars()
            .any(|c| c.is_control() || matches!(c, '\\' | ':'))
        || path.split('/').any(|part| matches!(part, "" | "." | ".."))
    {
        return Err(invalid(Rejection::Path));
    }
    Ok(())
}

/// Pure namespace value; ancestors participate in file/directory conflicts.
#[derive(Debug)]
pub(crate) struct Namespace {
    prefixes: BTreeMap<[u8; 32], ([u8; 32], bool)>,
    limits: Limits,
}

impl Namespace {
    pub(crate) fn new(limits: Limits) -> Self {
        Self {
            prefixes: BTreeMap::new(),
            limits,
        }
    }

    pub(crate) fn insert(&mut self, path: &str, directory: bool) -> Result<()> {
        validate(path, self.limits)?;
        let mut offset = 0;
        for part in path.split('/') {
            offset += part.len();
            let prefix = &path[..offset];
            let is_directory = offset < path.len() || directory;
            let key = digest(&prefix.to_lowercase());
            let original = digest(prefix);
            if let Some((previous, was_directory)) = self.prefixes.get(&key) {
                if !was_directory || !is_directory {
                    return Err(invalid(if *was_directory != is_directory {
                        Rejection::PathConflict
                    } else if *previous != original {
                        Rejection::CaseCollision
                    } else {
                        Rejection::DuplicatePath
                    }));
                }
            } else {
                if self.prefixes.len() == self.limits.prefixes() {
                    return Err(Error::TooLarge {
                        limit: Limit::PrefixCount,
                    });
                }
                self.prefixes.insert(key, (original, is_directory));
            }
            offset += 1;
        }
        Ok(())
    }
}

fn digest(value: &str) -> [u8; 32] {
    Sha256::digest(value.as_bytes()).into()
}

pub(crate) fn private(path: &str) -> bool {
    let lowercase = path.to_lowercase();
    let path = lowercase.as_str();
    path.split('/').any(|part| {
        part == "mokly-manifest.json" || (part.starts_with('.') && path != ".mokly-export-artifact")
    }) || [".ts", ".tsx", ".jsx", ".map"]
        .iter()
        .any(|suffix| path.ends_with(suffix))
        || path
            .split('/')
            .any(|part| part.starts_with("mokly.config."))
        || (path.starts_with("mokly-viewer/diffs/") && path.ends_with("/summary.md"))
}

#[cfg(test)]
#[path = "_tests_/paths_tests.rs"]
mod paths_tests;
