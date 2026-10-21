//! Locked package-manager installations sharing one deadline and disk budget.

use std::collections::BTreeSet;
use std::path::Path;
use std::time::Duration;

use sha2::{Digest, Sha256};

use crate::cache_types::Builder;
use crate::commands::Command;
use crate::dependencies::DependencyTiers;
use crate::dependency_types::Request;
use crate::error::{Error, Result};
use crate::inputs::Inputs;
use crate::manager::{Manager, Root};
use crate::manager_command;

pub(crate) struct Install<'a> {
    pub(crate) request: &'a Request,
    pub(crate) owner: &'a DependencyTiers,
    pub(crate) roots: Vec<Root>,
    pub(crate) deadline: Duration,
}

pub(crate) fn key(inputs: &Inputs, identity: &str, roots: &[Root]) -> String {
    let mut hash = Sha256::new();
    hash.update(inputs.key("manager-install-v2", identity).as_bytes());
    for root in roots {
        for value in [&root.directory, root.manager.identity(), &root.version] {
            hash.update((value.len() as u64).to_le_bytes());
            hash.update(value.as_bytes());
        }
    }
    if roots.iter().any(|root| root.manager != Manager::Npm) {
        hash.update((identity.len() as u64).to_le_bytes());
        hash.update(identity.as_bytes());
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
            if let Some(config) = &root.classic {
                let path = destination.join(&root.directory).join(".yarnrc");
                self.owner.storage.remove(&path)?;
                self.owner
                    .storage
                    .write(&path, &config.contents(destination)?)?;
            }
            let timeout = self.deadline.saturating_sub(self.owner.clock.now());
            if timeout.is_zero() {
                return Err(Error::InstallTimeout);
            }
            self.owner.commands.run(&Command {
                program: root.manager.program().into(),
                args: manager_command::arguments(root, destination),
                directory: destination.join(&root.directory),
                timeout,
                byte_limit: Some(self.owner.install_bytes),
                size_root: Some(destination.to_owned()),
                berry_cache: root
                    .berry_cache
                    .as_ref()
                    .map(|path| destination.join(&root.directory).join(path)),
            })?;
        }
        let mut caches = BTreeSet::new();
        for root in &self.roots {
            let directory = if root.manager == Manager::Npm {
                destination.to_owned()
            } else {
                destination.join(&root.directory)
            };
            caches.extend(
                manager_command::caches(root.manager)
                    .iter()
                    .map(|cache| directory.join(cache)),
            );
            if root.manager == Manager::YarnBerry
                && let Some(cache) = &root.berry_cache
            {
                caches.insert(directory.join(cache));
            }
        }
        for cache in caches {
            self.owner.storage.remove(&cache)?;
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/install_tests.rs"]
mod install_tests;
