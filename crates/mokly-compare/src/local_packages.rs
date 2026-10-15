//! Local dependency confinement for base installs.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;

use crate::error::Result;
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
