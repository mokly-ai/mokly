//! Select source and closure changes from the before-and-after membership snapshots.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::protection::{ProtectedBy, SourcePolicy};

use crate::error::{Error, InternalError, Result};

/// Only declared inputs, root members, folder metadata, and reached resources affect a build.
pub fn verify(
    config: &ResolvedConfig,
    sources: &[String],
    closure: &BTreeSet<String>,
    before: &BTreeMap<PathBuf, String>,
    after: &BTreeMap<PathBuf, String>,
) -> Result<()> {
    let policy = match SourcePolicy::new(config, sources) {
        Ok(policy) => policy,
        Err(source) => {
            return Err(InternalError::Catalogue {
                source: Box::new(source),
            }
            .into());
        }
    };
    for path in before.keys().chain(after.keys()) {
        let relative = relative(path, &config.repo_root);
        let folder = path.file_name().is_some_and(|name| name == "_folder.json")
            && config
                .roots
                .iter()
                .any(|root| path.starts_with(&root.directory) || path.starts_with(&root.identity));
        let selected = folder
            || closure.contains(&relative)
            || matches!(
                policy.denial(&relative, None),
                Some(ProtectedBy::RootMatch { .. } | ProtectedBy::ListedInput)
            );
        if selected && before.get(path) != after.get(path) {
            return Err(Error::InputsChanged { path: path.clone() });
        }
    }
    Ok(())
}
