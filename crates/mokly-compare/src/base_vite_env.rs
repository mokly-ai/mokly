//! Working dotenv inputs retained with a prepared Vite base.

use std::collections::BTreeMap;
use std::path::PathBuf;

use mokly_git::identity::RepoPath;
use mokly_git::repository::Repository;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{GitResult, Result};

/// The recorded index membership and working inputs of a base setup.
#[derive(Clone, Debug)]
pub struct ViteEnvInputs {
    /// Root of the working tree that supplies the dotenv candidates.
    pub working_root: PathBuf,
    /// The working index's paths for all supported dotenv file names.
    pub indexed: Vec<String>,
    /// The working candidates the base setup probed, with their digests if present.
    pub files: BTreeMap<String, Option<String>>,
    /// True when all base transforms observed the same version of each working file.
    pub consistent: bool,
}

/// Index membership is independent of ignore rules and working file presence.
pub fn indexed_paths(repository: &dyn Repository) -> Result<Vec<String>> {
    let paths = repository
        .indexed_paths(&[
            ":(glob)**/.env",
            ":(glob)**/.env.local",
            ":(glob)**/.env.development",
            ":(glob)**/.env.development.local",
        ])
        .base()?;
    Ok(paths.into_iter().map(|path| path.to_string()).collect())
}

impl ViteEnvInputs {
    /// Check the regular file each working path resolves to, or its absence.
    pub fn current(&self, repository: &dyn Repository, tree: &dyn SourceTree) -> Result<bool> {
        if !self.consistent || indexed_paths(repository)? != self.indexed {
            return Ok(false);
        }
        for (name, expected) in &self.files {
            let path = RepoPath::parse(name).base()?;
            let node = match tree.project(&self.working_root.join(path.as_str())) {
                Ok(node) => node,
                Err(_) => return Ok(false),
            };
            let current = match node.filter(|node| node.kind == FileKind::File) {
                Some(node) => match tree.digest_unretained(&node.identity) {
                    Ok(digest) => Some(digest),
                    Err(_) => return Ok(false),
                },
                None => None,
            };
            if &current != expected {
                return Ok(false);
            }
        }
        Ok(true)
    }
}

#[cfg(test)]
#[path = "_tests_/base_vite_env_tests.rs"]
mod base_vite_env_tests;
