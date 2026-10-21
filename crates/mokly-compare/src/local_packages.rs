//! Local dependency confinement for base installs.
//!
//! Yarn Classic rewrites `file:` and `link:` dependency values from their
//! manifest folder, so those use that folder. It resolves every other local
//! value from its lockfile folder, so those use the Classic root. Other
//! managers use the manifest folder.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::ancestor_roots;
use crate::error::Result;
use crate::local_specifications;
use crate::manager_classic;
use crate::manager_local;
use crate::manager_lockfiles;
use crate::manifest::{self, Manifest};
use crate::npm_lockfiles;
use crate::workspace_patterns;

pub(crate) fn manifests(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<BTreeMap<String, Manifest>> {
    files
        .iter()
        .filter(|(path, _)| path.as_str().rsplit('/').next() == Some("package.json"))
        .map(|(path, bytes)| {
            let parent = path
                .as_str()
                .rsplit_once('/')
                .map(|(parent, _)| parent)
                .unwrap_or("")
                .to_owned();
            Ok((parent, manifest::parse(bytes, path.as_str())?))
        })
        .collect()
}

/// Whether Yarn Classic rewrites a dependency value from its manifest folder.
fn rewritten(value: &str) -> bool {
    value.starts_with("file:") || value.starts_with("link:")
}

pub(crate) fn validate(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<()> {
    for (directory, manifest) in manifests(files)? {
        let lockfile = ancestor_roots::directories(&directory)
            .into_iter()
            .find_map(|root| {
                let path = if root.is_empty() {
                    "yarn.lock".to_owned()
                } else {
                    format!("{root}/yarn.lock")
                };
                files
                    .iter()
                    .find(|(candidate, _)| candidate.as_str() == path)
                    .map(|(_, bytes)| (root, manager_classic::lockfile(bytes)))
            });
        let berry = lockfile.as_ref().is_some_and(|(_, classic)| !classic);
        let (project, classic) = lockfile.unwrap_or_else(|| (directory.clone(), false));
        let values = manifest
            .packages()
            .map(|(_, value)| (value.as_str(), !classic || rewritten(value)))
            .chain(
                manifest
                    .replacements()
                    .into_iter()
                    .map(|value| (value, !classic)),
            );
        for (value, local) in values {
            let base = if local { &directory } else { &project };
            if berry {
                local_specifications::validate_berry(value, base, &project)?;
            } else {
                local_specifications::validate(value, base, &project)?;
            }
        }
        for workspace in manifest.workspaces() {
            workspace_patterns::confine(&directory, workspace)?;
        }
        for patch in manifest.patches() {
            manifest::target(&directory, patch)?;
        }
    }
    for (path, bytes) in files {
        match path.as_str().rsplit('/').next() {
            Some("pnpm-workspace.yaml") => manager_local::validate(bytes, path.as_str())?,
            Some("pnpm-lock.yaml" | "yarn.lock") => {
                manager_lockfiles::validate(bytes, path.as_str())?
            }
            Some("package-lock.json" | "npm-shrinkwrap.json") => {
                npm_lockfiles::validate(bytes, path.as_str())?
            }
            _ => {}
        }
    }
    Ok(())
}
