//! Validate the configured PostCSS module before a sidecar can start.

use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};
use serde_json::Value;

use crate::config::{invalid_path_text, normalize};
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::error::{CatalogueError, Result};

pub(crate) fn shape(value: &Value) -> Result<()> {
    if let Some(value) = value.get("postcss") {
        match value.as_str() {
            Some(path) if !path.is_empty() => {}
            Some(path) => return Err(path_error(path)),
            None => return Err(path_error(&value.to_string())),
        }
    }
    Ok(())
}

pub(crate) fn validate(tree: &dyn SourceTree, config: &ResolvedConfig) -> Result<Vec<PathBuf>> {
    let Some(value) = &config.input.postcss else {
        return Ok(Vec::new());
    };
    if value.is_empty()
        || invalid_path_text(value)
        || value.contains(':')
        || Path::new(value).is_absolute()
    {
        return Err(path_error(value));
    }
    let base = config.file.parent().unwrap_or(&config.repo_root);
    let path = normalize(&base.join(value));
    if !path.starts_with(&config.repo_root) {
        return Err(path_error(value));
    }
    if !matches!(
        path.extension().and_then(|extension| extension.to_str()),
        Some("ts" | "mts" | "js" | "mjs" | "cjs")
    ) {
        return Err(file_error(value));
    }
    let node = match tree.project(&path) {
        Ok(Some(node)) => node,
        _ => return Err(file_error(value)),
    };
    if !node.identity.starts_with(&config.repo_root) {
        return Err(path_error(value));
    }
    if node.kind != FileKind::File {
        return Err(file_error(value));
    }
    Ok(vec![path, node.identity])
}

fn path_error(value: &str) -> CatalogueError {
    invalid(format!(
        "postcss must name a config-relative module inside repoRoot: {value}; choose an existing .ts, .mts, .js, .mjs or .cjs file"
    ))
}

fn file_error(value: &str) -> CatalogueError {
    invalid(format!(
        "postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: {value}"
    ))
}

#[cfg(test)]
#[path = "_tests_/config_postcss_tests.rs"]
mod config_postcss_tests;
