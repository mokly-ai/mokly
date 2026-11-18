//! Validate configured inputs and retain their source-tree identities.

use std::path::PathBuf;

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::{invalid_path_text, relative};
use crate::config_links;
use crate::config_postcss;
use crate::config_types::{ResolvedConfig, ResolvedModules};
use crate::config_validation::invalid;
use crate::error::Result;

/// Validated module identities and all protected authored source aliases.
#[derive(Debug)]
pub(crate) struct ValidatedInputs {
    /// Lexical paths and physical source aliases retained for protection and watching.
    pub(crate) sources: Vec<PathBuf>,
    /// Configured module identities used by render consumers.
    pub(crate) modules: ResolvedModules,
}

/// One confined lexical input and the source-tree identity it projects to.
#[derive(Debug)]
pub(crate) struct ProjectedInput {
    /// Normalized config-relative input in the source tree.
    pub(crate) path: PathBuf,
    /// Projected target inside the repository.
    pub(crate) identity: PathBuf,
}

impl ProjectedInput {
    fn sources(self) -> [PathBuf; 2] {
        [self.path, self.identity]
    }
}

/// Project configured inputs once and retain module identities with their aliases.
pub(crate) fn validate_inputs(
    tree: &dyn SourceTree,
    config: &ResolvedConfig,
) -> Result<ValidatedInputs> {
    let mut sources = Vec::new();
    let mut modules = ResolvedModules::default();
    if let Some(module) = config_postcss::validate(tree, config)? {
        modules.postcss = Some(relative(&module.identity, &config.repo_root));
        sources.extend(module.sources());
    }
    if let Some(path) = &config.input.renderer {
        let module = confined(
            tree,
            config,
            "renderer",
            path,
            false,
            LinkDiagnostic::KeepExisting,
        )?;
        modules.renderer = Some(relative(&module.identity, &config.repo_root));
        sources.extend(module.sources());
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
                    sources.extend(
                        confined(
                            tree,
                            config,
                            &format!("stylesheets[{index}]"),
                            path,
                            false,
                            LinkDiagnostic::KeepExisting,
                        )?
                        .sources(),
                    );
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
    Ok(ValidatedInputs { sources, modules })
}

/// Only package roots name unresolved links in validation diagnostics.
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
) -> Result<ProjectedInput> {
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
    Ok(ProjectedInput {
        path,
        identity: node.identity,
    })
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
