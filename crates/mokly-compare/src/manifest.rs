//! Package-manifest dependency identity and confined local install inputs.

use std::collections::BTreeMap;

use mokly_git::identity::RepoPath;
use serde::Deserialize;

use crate::error::{Error, Result};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Manifest {
    pub(crate) package_manager: Option<String>,
    #[serde(default)]
    dependencies: BTreeMap<String, String>,
    #[serde(default)]
    dev_dependencies: BTreeMap<String, String>,
    #[serde(default)]
    optional_dependencies: BTreeMap<String, String>,
    workspaces: Option<Workspaces>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Workspaces {
    List(Vec<String>),
    Object { packages: Vec<String> },
}

impl Manifest {
    pub(crate) fn local(&self) -> bool {
        self.workspaces.is_some()
            || self
                .dependencies()
                .any(|value| value.starts_with("file:") || value.starts_with("link:"))
    }

    fn dependencies(&self) -> impl Iterator<Item = &String> {
        self.dependencies
            .values()
            .chain(self.dev_dependencies.values())
            .chain(self.optional_dependencies.values())
    }
}

pub(crate) fn validate(files: &BTreeMap<RepoPath, Vec<u8>>) -> Result<()> {
    for (path, bytes) in files
        .iter()
        .filter(|(path, _)| path.as_str().rsplit('/').next() == Some("package.json"))
    {
        let manifest: Manifest = match serde_json::from_slice(bytes) {
            Ok(manifest) => manifest,
            Err(_) => {
                return Err(Error::InvalidInput {
                    path: path.as_str().to_owned(),
                });
            }
        };
        let parent = path
            .as_str()
            .rsplit_once('/')
            .map(|(parent, _)| parent)
            .unwrap_or("");
        let workspaces: &[String] = match &manifest.workspaces {
            Some(Workspaces::List(packages) | Workspaces::Object { packages }) => packages,
            None => &[],
        };
        let local = manifest.dependencies().filter_map(|value| {
            value
                .strip_prefix("file:")
                .or_else(|| value.strip_prefix("link:"))
        });
        if local
            .chain(workspaces.iter().map(String::as_str))
            .any(|value| !confined(parent, value))
        {
            return Err(Error::InvalidInput {
                path: path.as_str().to_owned(),
            });
        }
    }
    Ok(())
}

fn confined(parent: &str, value: &str) -> bool {
    if value.is_empty() || value.starts_with('/') || value.contains(['\\', ':', '%', '\0']) {
        return false;
    }
    let mut depth = parent.split('/').filter(|part| !part.is_empty()).count();
    for part in value.split('/') {
        match part {
            ".." if depth == 0 => return false,
            ".." => depth -= 1,
            "" | "." => {}
            _ => depth += 1,
        }
    }
    true
}

#[cfg(test)]
#[path = "_tests_/manifest_tests.rs"]
mod manifest_tests;
