//! Locked package-manager installations sharing one deadline and disk budget.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use sha2::{Digest, Sha256};

use crate::cache_types::Builder;
use crate::commands::Command;
use crate::dependencies::DependencyTiers;
use crate::dependency_types::Request;
use crate::error::{Error, Result};
use crate::inputs::Inputs;
use crate::install_node::InstallNode;
use crate::manager::{Manager, Root};
use crate::manager_command;

pub(crate) struct Install<'a> {
    pub(crate) request: &'a Request,
    pub(crate) owner: &'a DependencyTiers,
    pub(crate) roots: Vec<Root>,
    pub(crate) deadline: Duration,
    pub(crate) node: Option<InstallNode>,
}

pub(crate) fn key(
    inputs: &Inputs,
    identity: &str,
    roots: &[Root],
    node: Option<&InstallNode>,
) -> String {
    let mut hash = Sha256::new();
    hash.update(inputs.key("manager-install-v4", identity).as_bytes());
    hash.update([u8::from(node.is_some())]);
    if let Some(node) = node {
        for value in [&node.version, &node.platform, &node.architecture] {
            hash.update((value.len() as u64).to_le_bytes());
            hash.update(value.as_bytes());
        }
    }
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
            let cache = cache(root, destination);
            if root.manager == Manager::YarnClassic
                && let Some(mirror) = &cache
            {
                self.owner.storage.prepare(mirror)?;
            }
            let timeout = self.deadline.saturating_sub(self.owner.clock.now());
            if timeout.is_zero() {
                return Err(Error::InstallTimeout);
            }
            self.owner.commands.run(&Command {
                program: root.manager.program().into(),
                args: manager_command::arguments(root, destination, self.request.install_scripts),
                directory: destination.join(&root.directory),
                timeout,
                byte_limit: Some(self.owner.install_bytes),
                size_root: Some(destination.to_owned()),
                cache,
                node: self.node.as_ref().map(|node| node.executable.clone()),
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
                caches.insert(cache.under(destination));
            }
            if root
                .classic
                .as_ref()
                .is_some_and(|config| config.mirror().is_none())
            {
                caches.insert(directory.join(PRIVATE_MIRROR));
            }
        }
        for cache in caches {
            self.owner.storage.remove(&cache)?;
        }
        Ok(())
    }
}

/// The Classic mirror that Mokly creates when the base configures none.
const PRIVATE_MIRROR: &str = ".yarn-mirror";

/// The private cache or mirror path that the manager command pins.
fn cache(root: &Root, destination: &Path) -> Option<PathBuf> {
    match root.manager {
        Manager::YarnBerry => root
            .berry_cache
            .as_ref()
            .map(|path| path.under(destination)),
        Manager::YarnClassic => Some(
            root.classic
                .as_ref()
                .and_then(|config| config.mirror())
                .map(|path| path.under(destination))
                .unwrap_or_else(|| destination.join(&root.directory).join(PRIVATE_MIRROR)),
        ),
        Manager::Npm | Manager::Pnpm => None,
    }
}

#[cfg(test)]
#[path = "_tests_/install_tests.rs"]
mod install_tests;

#[cfg(test)]
#[path = "_tests_/classic_install_tests.rs"]
mod classic_install_tests;
