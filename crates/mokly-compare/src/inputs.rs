//! Dependency identities from package manifests and package-manager lockfiles.

use std::collections::{BTreeMap, BTreeSet};

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Limits};
use sha2::{Digest, Sha256};

use crate::dependency_paths::LOCKFILES;
use crate::error::Result;
use crate::local_packages;
use crate::manager_plan;
use crate::manifest::Manifest;
use crate::sources::Sources;

/// Exact dependency inputs from one side, keyed by preserved POSIX spelling.
#[derive(Clone, Debug, Default)]
pub struct Inputs {
    /// Selected repository-owned package manifests and lockfiles.
    pub files: BTreeMap<RepoPath, Vec<u8>>,
    /// Git clean identities when the input reader can prove them.
    pub objects: BTreeMap<RepoPath, ObjectId>,
}

impl Inputs {
    /// First differing lockfile, or the base's selected lockfile for a manifest edit.
    pub fn differing_lockfile(&self, head: &Self, configured: &[String]) -> Option<RepoPath> {
        self.files
            .keys()
            .chain(head.files.keys())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .filter(|path| is_lock(path.as_str()))
            .find(|path| self.files.get(*path) != head.files.get(*path))
            .cloned()
            .or_else(|| self.selected_lockfile(configured))
    }

    /// Lockfile precedence for warning locations.
    pub fn lockfile(&self) -> Option<RepoPath> {
        LOCKFILES.iter().find_map(|name| {
            self.files
                .keys()
                .find(|path| path.as_str().rsplit('/').next() == Some(*name))
                .cloned()
        })
    }

    fn selected_lockfile(&self, configured: &[String]) -> Option<RepoPath> {
        manager_plan::directories(configured)
            .into_iter()
            .find_map(|root| {
                let prefix = if root.is_empty() {
                    String::new()
                } else {
                    format!("{root}/")
                };
                let manifest = self
                    .files
                    .iter()
                    .find(|(path, _)| path.as_str() == format!("{prefix}package.json"))
                    .and_then(|(_, bytes)| serde_json::from_slice::<Manifest>(bytes).ok());
                let manager = manifest
                    .as_ref()
                    .and_then(|manifest| manifest.package_manager.as_deref())
                    .and_then(|manager| manager.split('@').next());
                let names: &[&str] = match manager {
                    Some("npm") => &["npm-shrinkwrap.json", "package-lock.json"],
                    Some("pnpm") => &["pnpm-lock.yaml"],
                    Some("yarn") => &["yarn.lock"],
                    Some("bun") => &["bun.lock", "bun.lockb"],
                    _ => &[
                        "npm-shrinkwrap.json",
                        "package-lock.json",
                        "pnpm-lock.yaml",
                        "yarn.lock",
                        "bun.lock",
                        "bun.lockb",
                    ],
                };
                names.iter().find_map(|name| {
                    self.files
                        .keys()
                        .find(|path| path.as_str() == format!("{prefix}{name}"))
                        .cloned()
                })
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
        local_packages::validate(&self.files)
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
    path.rsplit('/')
        .next()
        .is_some_and(|name| LOCKFILES.contains(&name))
}

pub(crate) fn manager_lock(path: &str) -> bool {
    matches!(
        path.rsplit('/').next(),
        Some("pnpm-lock.yaml" | "yarn.lock")
    ) && !path.split('/').any(|part| part == "node_modules")
}

pub(crate) fn selected(path: &str, manager_config: bool) -> bool {
    is_lock(path)
        || path.rsplit('/').next() == Some("package.json")
        || manager_config
            && matches!(
                path.rsplit('/').next(),
                Some("pnpm-workspace.yaml" | ".yarnrc.yml" | ".yarnrc" | ".npmrc")
            )
}

/// Dependency inventory read boundary over an immutable source side.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = InputReaderMock))]
pub trait InputReader: Send + Sync {
    /// Read all repository manifests and lockfiles with an aggregate byte bound.
    fn read(&self, sources: &dyn Sources, limits: Limits) -> Result<Inputs>;
    /// Read only existing regular inputs at the supplied exact paths, without listing a tree.
    fn read_paths(
        &self,
        sources: &dyn Sources,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Inputs>;
}

/// Inventory reader for base blobs and future render-graph source adapters.
pub struct SourceInputs;

impl InputReader for SourceInputs {
    fn read(&self, sources: &dyn Sources, limits: Limits) -> Result<Inputs> {
        let entries = sources.list(&[None], limits)?;
        let manager_config = entries
            .iter()
            .any(|entry| manager_lock(entry.path.as_str()));
        let entries: Vec<_> = entries
            .into_iter()
            .filter(|entry| {
                selected(entry.path.as_str(), manager_config)
                    && !entry
                        .path
                        .as_str()
                        .split('/')
                        .any(|part| part == "node_modules")
            })
            .collect();
        load(sources, entries, limits)
    }

    fn read_paths(
        &self,
        sources: &dyn Sources,
        paths: &[RepoPath],
        limits: Limits,
    ) -> Result<Inputs> {
        if paths.is_empty() {
            return Ok(Inputs::default());
        }
        sources.ensure(paths)?;
        let index = sources.index()?;
        let entries = paths
            .iter()
            .filter_map(|path| index.entries.get(path))
            .filter(|entry| entry.mode.regular())
            .cloned()
            .collect();
        load(sources, entries, limits)
    }
}

fn load(sources: &dyn Sources, entries: Vec<Entry>, limits: Limits) -> Result<Inputs> {
    let paths = entries
        .iter()
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>();
    let bytes = sources.read_many(&paths, limits)?;
    let files = paths.into_iter().zip(bytes).collect();
    let objects = entries
        .into_iter()
        .map(|entry| (entry.path, entry.object))
        .collect();
    Ok(Inputs { files, objects })
}

impl PartialEq for Inputs {
    fn eq(&self, other: &Self) -> bool {
        self.files.len() == other.files.len()
            && self.files.iter().all(|(path, bytes)| {
                let Some(candidate) = other.files.get(path) else {
                    return false;
                };
                match (self.objects.get(path), other.objects.get(path)) {
                    (Some(left), Some(right)) => left == right,
                    _ => bytes == candidate,
                }
            })
    }
}

impl Eq for Inputs {}

#[cfg(test)]
#[path = "_tests_/inputs_tests.rs"]
mod inputs_tests;
