//! Physical confinement for configuration filesystem fields.

use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::{invalid_path_text, normalize, relative};
use crate::config_links;
use crate::config_postcss;
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::error::Result;

impl ResolvedConfig {
    /// The repository-relative POSIX path that a config-relative value names:
    /// the value joined to the configuration directory, without `.`, `..`, or
    /// empty segments. A symbolic link before `..` does not change it. The
    /// repository root itself is empty. A value that leaves `repo_root` has
    /// no repository path; loading rejects every such configured value.
    pub fn repository_path(&self, value: &str) -> Option<String> {
        let path = self.local_path(value);
        path.starts_with(&self.repo_root)
            .then(|| relative(&path, &self.repo_root))
    }

    /// The configured renderer module as its repository path.
    pub fn renderer(&self) -> Option<String> {
        self.input
            .renderer
            .as_deref()
            .and_then(|value| self.repository_path(value))
    }

    /// The configured PostCSS module as its repository path.
    pub fn postcss(&self) -> Option<String> {
        self.input
            .postcss
            .as_deref()
            .and_then(|value| self.repository_path(value))
    }

    /// Package roots as repository paths, in authored order. Every consumer
    /// reads this form.
    pub fn package_roots(&self) -> Vec<String> {
        self.authored_package_roots()
            .filter_map(|root| self.repository_path(root))
            .collect()
    }

    fn authored_package_roots(&self) -> impl Iterator<Item = &String> {
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

pub(crate) fn validate_inputs(
    tree: &dyn SourceTree,
    config: &ResolvedConfig,
) -> Result<Vec<PathBuf>> {
    let mut sources = config_postcss::validate(tree, config)?;
    if let Some(path) = &config.input.renderer {
        sources.extend(confined(
            tree,
            config,
            "renderer",
            path,
            false,
            LinkDiagnostic::KeepExisting,
        )?);
    }
    for (index, rule) in config.input.stylesheets.iter().flatten().enumerate() {
        for list in [
            &rule.stylesheets,
            rule.light_stylesheets.as_ref().unwrap_or(&Vec::new()),
            rule.dark_stylesheets.as_ref().unwrap_or(&Vec::new()),
        ] {
            for path in list {
                if !path.starts_with('$')
                    && !path.starts_with("https://")
                    && !path.starts_with("http://")
                {
                    sources.extend(confined(
                        tree,
                        config,
                        &format!("stylesheets[{index}]"),
                        path,
                        false,
                        LinkDiagnostic::KeepExisting,
                    )?);
                }
            }
        }
    }
    for (index, path) in config.authored_package_roots().enumerate() {
        confined(
            tree,
            config,
            &format!("moduleResolution.packageRoots[{index}]"),
            path,
            true,
            LinkDiagnostic::NameLink,
        )?;
        if !has_manifest(tree, config, path) {
            return Err(invalid(format!(
                "moduleResolution.packageRoots[{index}]: {path} must contain package.json"
            )));
        }
    }
    for path in config
        .input
        .watch
        .iter()
        .flat_map(|watch| watch.rules.iter().flatten())
        .flat_map(|rule| &rule.paths)
    {
        let prefix: String = path
            .chars()
            .take_while(|c| !matches!(c, '*' | '?' | '[' | '{'))
            .collect();
        let mut candidate = config.repo_root.join(prefix);
        loop {
            match tree.project(&candidate) {
                Ok(Some(node)) => {
                    if !node.identity.starts_with(&config.repo_root) {
                        return Err(invalid(format!(
                            "watch.rules.paths: {path} cannot be classified safely outside repoRoot"
                        )));
                    }
                    break;
                }
                Ok(None) => {
                    if !candidate.pop() {
                        break;
                    }
                }
                Err(error) => {
                    return Err(invalid(format!(
                        "watch.rules.paths: {path}: {}",
                        error.code()
                    )));
                }
            }
        }
    }
    Ok(sources)
}

/// Only package roots name unresolved links under user decision 174 C.
#[derive(Clone, Copy)]
enum LinkDiagnostic {
    /// Keep the existing messages for renderer modules and local stylesheets.
    KeepExisting,
    /// Name the unresolved link when a package root fails validation.
    NameLink,
}

fn confined(
    tree: &dyn SourceTree,
    config: &ResolvedConfig,
    setting: &str,
    value: &str,
    directory: bool,
    link_diagnostic: LinkDiagnostic,
) -> Result<Vec<PathBuf>> {
    if invalid_path_text(value) || value.contains(':') {
        return Err(invalid(format!(
            "{setting}: path traversal or invalid path {value}"
        )));
    }
    let path = config.local_path(value);
    let node = match tree.project(&path) {
        Ok(node) => node,
        Err(error) => return Err(invalid(format!("{setting}: {value}: {}", error.code()))),
    };
    let Some(node) = node else {
        if matches!(link_diagnostic, LinkDiagnostic::NameLink)
            && let Some(error) =
                config_links::link_error(tree, &path, &config.repo_root, setting, value)
        {
            return Err(error);
        }
        return Err(invalid(format!("{setting}: {value} does not exist")));
    };
    let expected = if directory {
        FileKind::Directory
    } else {
        FileKind::File
    };
    if !node.identity.starts_with(&config.repo_root) || !path.starts_with(&config.repo_root) {
        return Err(invalid(format!("{setting}: {value} is outside repoRoot")));
    }
    if node.kind != expected {
        if matches!(link_diagnostic, LinkDiagnostic::NameLink)
            && let Some(error) =
                config_links::link_error(tree, &path, &config.repo_root, setting, value)
        {
            return Err(error);
        }
        return Err(invalid(format!(
            "{setting}: {value} must be a {}",
            if directory {
                "directory"
            } else {
                "regular file"
            }
        )));
    }
    Ok(vec![path, node.identity])
}

/// The normalized root needs `package.json`. A symbolic link before `..` in
/// the authored spelling does not change which directory that is.
fn has_manifest(tree: &dyn SourceTree, config: &ResolvedConfig, value: &str) -> bool {
    matches!(
        tree.project(&config.local_path(value).join("package.json")),
        Ok(Some(node)) if node.kind == FileKind::File
    )
}

#[cfg(test)]
#[path = "_tests_/package_roots_tests.rs"]
mod package_roots_tests;

#[cfg(test)]
#[path = "_tests_/repository_path_tests.rs"]
mod repository_path_tests;
