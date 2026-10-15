//! Dependency identity from every package manifest and package-manager lockfile.

use std::collections::{BTreeMap, BTreeSet};

use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};
use crate::manifest::{self, Manifest};
use crate::sources::Sources;

/// Exact dependency inputs from one side, keyed by preserved POSIX spelling.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Inputs {
    /// All repository-owned package manifests and lockfiles.
    pub files: BTreeMap<RepoPath, Vec<u8>>,
}

impl Inputs {
    /// First differing lockfile, or the base's selected lockfile for a manifest edit.
    pub fn differing_lockfile(&self, head: &Self) -> Option<RepoPath> {
        self.files
            .keys()
            .chain(head.files.keys())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .filter(|path| is_lock(path.as_str()))
            .find(|path| self.files.get(*path) != head.files.get(*path))
            .cloned()
            .or_else(|| self.lockfile())
    }

    /// Npm lockfile precedence. Other managers follow the fallback tier.
    pub fn lockfile(&self) -> Option<RepoPath> {
        [
            "npm-shrinkwrap.json",
            "package-lock.json",
            "pnpm-lock.yaml",
            "yarn.lock",
            "bun.lock",
            "bun.lockb",
        ]
        .iter()
        .find_map(|name| {
            self.files
                .keys()
                .find(|path| path.as_str() == *name)
                .cloned()
        })
    }

    /// Whether this snapshot can be installed with npm's lockfile contract.
    pub fn supports_npm(&self) -> bool {
        let Some(lockfile) = self.lockfile() else {
            return false;
        };
        if !matches!(
            lockfile.as_str(),
            "npm-shrinkwrap.json" | "package-lock.json"
        ) {
            return false;
        }
        self.manifests().all(|manifest| {
            manifest
                .package_manager
                .is_none_or(|manager| manager.starts_with("npm@"))
        })
    }

    /// Cache key includes exact manifests, lockfiles, manager version and local-source identity.
    pub fn key(&self, version: &str, source_identity: &str) -> String {
        let mut hash = Sha256::new();
        frame(&mut hash, b"mokly-dependencies-v1");
        frame(&mut hash, version.as_bytes());
        for (path, bytes) in &self.files {
            frame(&mut hash, path.as_str().as_bytes());
            frame(&mut hash, bytes);
        }
        if self.manifests().any(|manifest| manifest.local()) {
            frame(&mut hash, source_identity.as_bytes());
        }
        hash.finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    /// Verify that local package and workspace paths stay in the extracted source root.
    pub fn validate_install(&self) -> Result<()> {
        manifest::validate(&self.files)
    }

    fn manifests(&self) -> impl Iterator<Item = Manifest> + '_ {
        self.files
            .iter()
            .filter(|(path, _)| path.as_str().rsplit('/').next() == Some("package.json"))
            .filter_map(|(_, bytes)| serde_json::from_slice(bytes).ok())
    }
}

fn frame(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_le_bytes());
    hash.update(bytes);
}

pub(crate) fn is_lock(path: &str) -> bool {
    matches!(
        path.rsplit('/').next(),
        Some(
            "package-lock.json"
                | "npm-shrinkwrap.json"
                | "pnpm-lock.yaml"
                | "yarn.lock"
                | "bun.lock"
                | "bun.lockb"
        )
    )
}

pub(crate) fn selected(path: &str) -> bool {
    is_lock(path) || path.rsplit('/').next() == Some("package.json")
}

/// Dependency inventory read boundary over an immutable source side.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = InputReaderMock))]
pub trait InputReader: Send + Sync {
    /// Read exact dependency inputs with an aggregate byte bound.
    fn read(&self, sources: &dyn Sources, limits: Limits) -> Result<Inputs>;
}

/// Inventory reader for base blobs and future render-graph source adapters.
pub struct SourceInputs;

impl InputReader for SourceInputs {
    fn read(&self, sources: &dyn Sources, limits: Limits) -> Result<Inputs> {
        let mut files = BTreeMap::new();
        let mut total = 0usize;
        for entry in sources.list(&[None], limits)? {
            if selected(entry.path.as_str()) && !excluded(entry.path.as_str()) {
                let bytes = sources.read(&entry.path, limits.blob)?;
                total = total.saturating_add(bytes.len());
                if total > limits.bytes {
                    return Err(Error::CacheLimit {
                        limit: limits.bytes as u64,
                    });
                }
                files.insert(entry.path, bytes);
            }
        }
        Ok(Inputs { files })
    }
}

pub(crate) fn excluded(path: &str) -> bool {
    path.split('/').any(|part| {
        matches!(
            part,
            ".git"
                | "node_modules"
                | ".context"
                | "target"
                | "dist"
                | "coverage"
                | "test-results"
                | "playwright-report"
        )
    })
}

#[cfg(test)]
#[path = "_tests_/inputs_tests.rs"]
mod inputs_tests;
