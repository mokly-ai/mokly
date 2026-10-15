//! Workspace and directory-package inventory from exact base manifests.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::{Error, Result};
use crate::manifest::{self, Manifest};
use crate::workspaces::{self, Workspaces};

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

pub(crate) fn packages(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<BTreeMap<String, String>> {
    let manifests = manifests(files)?;
    let mut packages = BTreeMap::new();
    for (directory, manifest) in &manifests {
        let workspaces = Workspaces::new(directory, manifest.workspaces())?;
        for (path, candidate) in &manifests {
            if path != directory && workspaces.matches(path) {
                let name = candidate
                    .name
                    .clone()
                    .unwrap_or_else(|| workspaces::name(path));
                insert(&mut packages, &name, path)?;
            }
        }
        for (name, value) in manifest
            .packages()
            .map(|(name, value)| (name.as_str(), value.as_str()))
            .chain(manifest.overrides())
        {
            if let Some(local) = manifest::local(value) {
                let Ok(target) = manifest::target(directory, local) else {
                    continue;
                };
                let lower = target.to_ascii_lowercase();
                if !lower.ends_with(".tgz")
                    && !lower.ends_with(".tar.gz")
                    && !lower.ends_with(".tar")
                {
                    insert(&mut packages, name, &target)?;
                }
            }
        }
    }
    Ok(packages)
}

fn insert(packages: &mut BTreeMap<String, String>, name: &str, path: &str) -> Result<()> {
    let parts = name.split('/').collect::<Vec<_>>();
    let safe = matches!(parts.as_slice(), [name] if !name.starts_with('@'))
        || matches!(parts.as_slice(), [scope, _] if scope.starts_with('@'));
    if !safe
        || parts.iter().any(|part| {
            part.is_empty() || matches!(*part, "." | "..") || part.contains(['\\', ':', '\0'])
        })
    {
        return Err(Error::InvalidInput {
            path: name.to_owned(),
        });
    }
    if packages.get(name).is_some_and(|previous| previous != path) {
        return Err(Error::InvalidInput {
            path: name.to_owned(),
        });
    }
    packages.insert(name.to_owned(), path.to_owned());
    Ok(())
}

pub(crate) fn validate(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<()> {
    for (directory, manifest) in manifests(files)? {
        for value in manifest.specifications() {
            if let Some(local) = manifest::local(value) {
                manifest::target(&directory, local)?;
            }
        }
        for workspace in manifest.workspaces() {
            manifest::target(&directory, workspace)?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/local_packages_tests.rs"]
mod local_packages_tests;
