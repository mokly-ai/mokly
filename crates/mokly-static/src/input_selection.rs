//! Configured root selection shared by initial capture and final membership checks.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::protection::SourcePolicy;

use crate::error::{Error, InternalError, Result};

pub(crate) struct Selection {
    pub(crate) config: ResolvedConfig,
    pub(crate) excluded: Vec<PathBuf>,
    policy: SourcePolicy,
}

impl Selection {
    pub(crate) fn new(config: &ResolvedConfig, excluded: &[PathBuf]) -> Result<Self> {
        let policy = match SourcePolicy::new(config, &[]) {
            Ok(policy) => policy,
            Err(source) => {
                return Err(InternalError::Catalogue {
                    source: Box::new(source),
                }
                .into());
            }
        };
        Ok(Self {
            config: config.clone(),
            excluded: excluded.to_vec(),
            policy,
        })
    }

    pub(crate) fn selected(&self, index: usize, path: &Path) -> bool {
        (path.file_name().is_some_and(|name| name == "_folder.json")
            && self.config.roots.get(index).is_some_and(|root| {
                path.starts_with(&root.directory) || path.starts_with(&root.identity)
            }))
            || self
                .policy
                .root_matches(index, &relative(path, &self.config.repo_root))
    }

    pub(crate) fn root(&self, path: &Path) -> bool {
        path == self.config.repo_root
            || self
                .config
                .roots
                .iter()
                .any(|root| path == root.directory || path == root.identity)
    }
}

/// Fails on the first path that only one of the two captures holds, so an
/// added or a removed root member or unreadable marker is an input change.
pub(crate) fn verify(before: &BTreeSet<PathBuf>, after: &BTreeSet<PathBuf>) -> Result<()> {
    if let Some(path) = before.symmetric_difference(after).next() {
        return Err(Error::InputsChanged { path: path.clone() });
    }
    Ok(())
}
