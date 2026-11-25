//! Working dotenv inputs retained with a prepared Vite base.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_git::error;
use mokly_git::repository::Repository;
use mokly_git::tree::{Limits, Mode};
use mokly_sidecar::bundle_params::ViteBaseEnv;
use mokly_source_interface::error::Result as SourceResult;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{Error, GitResult, Result};
use crate::sources::TreeIndex;

/// The recorded index membership and working inputs of a base setup.
#[derive(Clone, Debug)]
pub struct ViteEnvInputs {
    /// The working index's paths for dotenv files and possible link targets.
    pub indexed: Vec<String>,
    /// The pathspecs used to sample the same index membership again.
    pub index_patterns: Vec<String>,
    /// The working candidates the base setup probed, with their digests if present.
    pub files: BTreeMap<PathBuf, Option<String>>,
    /// True when all base transforms observed the same version of each working file.
    pub consistent: bool,
}

/// Select the pinned lookup and index metadata needed for a historical setup.
pub fn setup_sources(
    working_root: &Path,
    repository: &dyn Repository,
    tree: &TreeIndex,
) -> Result<ViteBaseEnv> {
    let mut objects = BTreeMap::new();
    let mut links = BTreeMap::new();
    for entry in tree
        .entries
        .values()
        .filter(|entry| entry.mode == Mode::Symlink)
    {
        let target = if let Some(target) = objects.get(&entry.object) {
            Option::<String>::clone(target)
        } else {
            let target = match repository.read_link(entry, Limits::default().blob) {
                Ok(bytes) => String::from_utf8(bytes)
                    .ok()
                    .filter(|target| !target.is_empty() && !target.contains('\0')),
                Err(error::Error::Cancelled) => return Err(Error::Cancelled),
                Err(error) => {
                    tracing::debug!(path = %entry.path, %error, "base dotenv link target is unavailable");
                    None
                }
            };
            objects.insert(entry.object.clone(), target.clone());
            target
        };
        links.insert(entry.path.to_string(), target);
    }
    let names = target_names(&links);
    let pinned = tree
        .entries
        .keys()
        .filter_map(|path| {
            let name = path.as_str().rsplit('/').next()?;
            names.contains(name).then(|| path.to_string())
        })
        .collect();
    Ok(ViteBaseEnv {
        working_root: working_root.to_string_lossy().into_owned(),
        indexed: indexed_paths(repository, &index_patterns(&names))?,
        pinned,
        links,
    })
}

fn target_names(links: &BTreeMap<String, Option<String>>) -> BTreeSet<&str> {
    [
        ".env",
        ".env.local",
        ".env.development",
        ".env.development.local",
    ]
    .into_iter()
    .chain(
        links
            .values()
            .flatten()
            .filter_map(|target| Path::new(target).file_name()?.to_str()),
    )
    .collect()
}

fn index_patterns(names: &BTreeSet<&str>) -> Vec<String> {
    names
        .iter()
        .map(|name| {
            let mut pattern = String::from(":(glob)**/");
            for character in name.chars() {
                if matches!(character, '\\' | '?' | '*' | '[') {
                    pattern.push('\\');
                }
                pattern.push(character);
            }
            pattern
        })
        .collect()
}

fn indexed_paths(repository: &dyn Repository, patterns: &[String]) -> Result<Vec<String>> {
    let pathspecs: Vec<_> = patterns.iter().map(String::as_str).collect();
    let paths = repository.indexed_paths(&pathspecs).base()?;
    Ok(paths.into_iter().map(|path| path.to_string()).collect())
}

impl ViteEnvInputs {
    /// Retain the working index selection sampled for this setup.
    pub fn new(setup: &ViteBaseEnv) -> Self {
        Self {
            indexed: setup.indexed.clone(),
            index_patterns: index_patterns(&target_names(&setup.links)),
            files: BTreeMap::new(),
            consistent: true,
        }
    }

    /// Check the regular file each working path resolves to, or its absence.
    pub fn current(&self, repository: &dyn Repository, tree: &dyn SourceTree) -> Result<bool> {
        if !self.consistent || indexed_paths(repository, &self.index_patterns)? != self.indexed {
            return Ok(false);
        }
        Ok(self.files.iter().all(|(path, expected)| {
            candidate_digest(tree, path).is_ok_and(|current| &current == expected)
        }))
    }
}

/// Read the digest of a candidate that resolves to a regular file.
pub fn candidate_digest(tree: &dyn SourceTree, path: &Path) -> SourceResult<Option<String>> {
    tree.project(path)?
        .filter(|node| node.kind == FileKind::File)
        .map(|node| tree.digest_unretained(&node.identity))
        .transpose()
}

#[cfg(test)]
#[path = "_tests_/base_vite_env_tests.rs"]
mod base_vite_env_tests;
