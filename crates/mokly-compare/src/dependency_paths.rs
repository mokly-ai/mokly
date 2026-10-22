//! Exact dependency identity paths for used installation directories and their ancestors.

use std::collections::BTreeSet;

use mokly_git::identity::RepoPath;

use crate::ancestor_roots::{dependency_directory, directories};
use crate::error::{GitResult, Result};

pub(crate) const LOCKFILES: [&str; 6] = [
    "npm-shrinkwrap.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
];

/// Select manifests and lockfiles beside used node_modules directories and at their ancestors.
pub fn governing(used: &[String]) -> Result<Vec<RepoPath>> {
    let mut paths = BTreeSet::new();
    for directory in used {
        if dependency_directory(directory).as_ref() != Some(directory) {
            continue;
        }
        let owner = directory
            .strip_suffix("node_modules")
            .unwrap_or_default()
            .trim_end_matches('/');
        for root in directories(owner) {
            for name in std::iter::once("package.json").chain(LOCKFILES) {
                let path = if root.is_empty() {
                    name.into()
                } else {
                    format!("{root}/{name}")
                };
                paths.insert(RepoPath::parse(&path).base()?);
            }
        }
    }
    Ok(paths.into_iter().collect())
}

#[cfg(test)]
#[path = "_tests_/scoped_inputs_tests.rs"]
mod scoped_inputs_tests;
