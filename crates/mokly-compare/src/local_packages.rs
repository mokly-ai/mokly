//! Local dependency confinement for base installs.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::ancestor_roots;
use crate::error::Result;
use crate::local_specifications;
use crate::manager_local;
use crate::manager_lockfiles;
use crate::manifest::{self, Manifest};

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

pub(crate) fn validate(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<()> {
    let package_manifests = manifests(files)?;
    let contexts = package_manifests
        .iter()
        .map(|(directory, manifest)| {
            (
                directory.clone(),
                manifest
                    .specifications()
                    .into_iter()
                    .map(str::to_owned)
                    .collect::<Vec<_>>(),
            )
        })
        .collect::<Vec<_>>();
    for (directory, manifest) in package_manifests {
        let project = ancestor_roots::directories(&directory)
            .into_iter()
            .find(|root| {
                let path = if root.is_empty() {
                    "yarn.lock".to_owned()
                } else {
                    format!("{root}/yarn.lock")
                };
                files.keys().any(|candidate| candidate.as_str() == path)
            })
            .unwrap_or_else(|| directory.clone());
        for value in manifest.specifications() {
            local_specifications::validate(value, &directory, &project)?;
        }
        for workspace in manifest.workspaces() {
            manifest::targets(&directory, workspace)?;
        }
        for patch in manifest.patches() {
            manifest::target(&directory, patch)?;
        }
    }
    for (path, bytes) in files {
        match path.as_str().rsplit('/').next() {
            Some("pnpm-workspace.yaml") => manager_local::validate(bytes, path.as_str())?,
            Some("pnpm-lock.yaml" | "yarn.lock") => {
                manager_lockfiles::validate_with_context(bytes, path.as_str(), &contexts)?
            }
            _ => {}
        }
    }
    Ok(())
}
