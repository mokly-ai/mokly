//! Npm installation plans with one deadline for root and configured packages.

use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

use sha2::{Digest, Sha256};

use crate::cache_types::Builder;
use crate::commands::Command;
use crate::dependencies::DependencyTiers;
use crate::dependency_types::Request;
use crate::error::{Error, Result};
use crate::inputs::Inputs;
use crate::local_packages;

pub(crate) struct Install<'a> {
    pub(crate) request: &'a Request,
    pub(crate) owner: &'a DependencyTiers,
    pub(crate) roots: Vec<String>,
    pub(crate) deadline: Duration,
}

pub(crate) fn roots(inputs: &Inputs, configured: &[String]) -> Result<Vec<String>> {
    let manifests = local_packages::manifests(&inputs.files)?;
    let mut roots = Vec::new();
    for root in std::iter::once("").chain(configured.iter().map(String::as_str)) {
        if roots.iter().any(|value| value == root) {
            continue;
        }
        let prefix = if root.is_empty() {
            String::new()
        } else {
            format!("{root}/")
        };
        let lock = ["npm-shrinkwrap.json", "package-lock.json"]
            .iter()
            .any(|name| {
                inputs
                    .files
                    .keys()
                    .any(|path| path.as_str() == format!("{prefix}{name}"))
            });
        if !lock {
            continue;
        }
        if manifests
            .get(root)
            .and_then(|manifest| manifest.package_manager.as_ref())
            .is_some_and(|manager| !manager.starts_with("npm@"))
        {
            return Err(Error::UnsupportedManager);
        }
        roots.push(root.to_owned());
    }
    if roots.is_empty() {
        return Err(Error::UnsupportedManager);
    }
    Ok(roots)
}

pub(crate) fn key(inputs: &Inputs, version: &str, identity: &str, roots: &[String]) -> String {
    let mut hash = Sha256::new();
    hash.update(inputs.key(version, identity).as_bytes());
    for root in roots {
        hash.update((root.len() as u64).to_le_bytes());
        hash.update(root.as_bytes());
    }
    hash.finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

impl Builder for Install<'_> {
    fn build(&self, destination: &Path) -> Result<()> {
        self.owner.storage.copy(
            &self.request.source_root,
            destination,
            self.owner.install_bytes,
        )?;
        for root in &self.roots {
            let timeout = self.deadline.saturating_sub(self.owner.clock.now());
            if timeout.is_zero() {
                return Err(Error::InstallTimeout);
            }
            let directory = destination.join(root);
            let mut args: Vec<OsString> = [
                "ci",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--cache",
            ]
            .into_iter()
            .map(Into::into)
            .collect();
            args.push(destination.join(".npm-cache").into_os_string());
            args.extend([
                OsString::from("--logs-dir"),
                destination.join(".npm-cache/_logs").into_os_string(),
                OsString::from("--prefix"),
                directory.clone().into_os_string(),
            ]);
            self.owner.commands.run(&Command {
                program: "npm".into(),
                args,
                directory,
                timeout,
                byte_limit: Some(self.owner.install_bytes),
                size_root: Some(destination.to_owned()),
            })?;
        }
        self.owner.storage.remove(&destination.join(".npm-cache"))
    }
}

#[cfg(test)]
#[path = "_tests_/install_tests.rs"]
mod install_tests;
