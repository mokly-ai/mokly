//! Configuration path spellings and retained module identities.

use std::path::{Path, PathBuf};

use mokly_source_interface::tree::SourceTree;

use crate::config::{normalize, relative};
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::error::Result;

/// Check lexical and projected paths against the resolved repository root.
pub(crate) fn confined_to_repository(repo_root: &Path, paths: &[&Path]) -> bool {
    paths.iter().all(|path| path.starts_with(repo_root))
}

impl ResolvedConfig {
    /// The repository-relative POSIX path that a config-relative value names:
    /// the value joined to the configuration directory, without `.`, `..`, or
    /// empty segments. A symbolic link before `..` does not change it. The
    /// repository root itself is empty. A value that leaves `repo_root` has
    /// no repository path; loading rejects every such configured value.
    pub fn repository_path(&self, value: &str) -> Option<String> {
        let path = self.local_path(value);
        confined_to_repository(&self.repo_root, &[&path]).then(|| relative(&path, &self.repo_root))
    }

    /// The configured renderer module's resolved repository-relative identity.
    pub fn renderer(&self) -> Option<String> {
        self.modules.renderer.clone()
    }

    /// The configured PostCSS module's resolved repository-relative identity.
    pub fn postcss(&self) -> Option<String> {
        self.modules.postcss.clone()
    }

    /// Package roots as repository paths, in authored order. Every consumer
    /// reads this form.
    pub fn package_roots(&self) -> Vec<String> {
        self.authored_package_roots()
            .filter_map(|root| self.repository_path(root))
            .collect()
    }

    /// Package-root spellings before lexical normalization.
    pub(crate) fn authored_package_roots(&self) -> impl Iterator<Item = &String> {
        self.input
            .module_resolution
            .iter()
            .flat_map(|module| module.package_roots.iter().flatten())
    }

    /// The source-tree path that a config-relative value names. Loading
    /// projects this path for every check.
    pub(crate) fn local_path(&self, value: &str) -> PathBuf {
        normalize(&self.file.parent().unwrap_or(&self.repo_root).join(value))
    }
}

/// Keep the selected filename while resolving aliases above the repository.
pub(crate) fn configuration_alias(
    tree: &dyn SourceTree,
    lexical: &Path,
    config: &ResolvedConfig,
) -> Result<Option<PathBuf>> {
    if lexical == config.file {
        return Ok(None);
    }
    let alias = if lexical.starts_with(&config.repo_root) {
        lexical.to_owned()
    } else if let Some(parent) = lexical.parent() {
        match tree.project(parent) {
            Ok(Some(node)) if node.identity.starts_with(&config.repo_root) => {
                node.identity.join(lexical.file_name().unwrap_or_default())
            }
            Ok(_) => return Ok(None),
            Err(error) => {
                return Err(invalid(format!(
                    "{}: {}",
                    relative(parent, &config.repo_root),
                    error.code()
                )));
            }
        }
    } else {
        return Ok(None);
    };
    Ok((alias != config.file).then_some(alias))
}

#[cfg(test)]
#[path = "_tests_/repository_path_tests.rs"]
mod repository_path_tests;
