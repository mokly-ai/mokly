//! Physical confinement for configuration filesystem fields.

use std::path::PathBuf;

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::{invalid_path_text, normalize};
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::error::Result;

pub(crate) fn validate_inputs(
    tree: &dyn SourceTree,
    config: &ResolvedConfig,
) -> Result<Vec<PathBuf>> {
    let mut sources = Vec::new();
    for (setting, path) in [
        ("renderer", &config.input.renderer),
        ("postcss", &config.input.postcss),
    ] {
        if let Some(path) = path {
            sources.extend(confined(tree, config, setting, path, false)?);
        }
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
                    )?);
                }
            }
        }
    }
    for (index, path) in config
        .input
        .module_resolution
        .iter()
        .flat_map(|module| module.package_roots.iter().flatten())
        .enumerate()
    {
        confined(
            tree,
            config,
            &format!("moduleResolution.packageRoots[{index}]"),
            path,
            true,
        )?;
        let directory = config.file.parent().unwrap_or(&config.repo_root).join(path);
        match tree.project(&directory.join("package.json")) {
            Ok(Some(node)) if node.kind == FileKind::File => {}
            _ => {
                return Err(invalid(format!(
                    "moduleResolution.packageRoots[{index}]: {path} must contain package.json"
                )));
            }
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

fn confined(
    tree: &dyn SourceTree,
    config: &ResolvedConfig,
    setting: &str,
    value: &str,
    directory: bool,
) -> Result<Vec<PathBuf>> {
    if invalid_path_text(value) || value.contains(':') {
        return Err(invalid(format!(
            "{setting}: path traversal or invalid path {value}"
        )));
    }
    let base = config.file.parent().unwrap_or(&config.repo_root);
    let path = normalize(&base.join(value));
    let node = match tree.project(&path) {
        Ok(node) => node,
        Err(error) => return Err(invalid(format!("{setting}: {value}: {}", error.code()))),
    };
    let Some(node) = node else {
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
