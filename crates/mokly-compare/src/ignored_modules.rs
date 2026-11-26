//! Match actual head imports against Git's working-tree inventory.

use std::fmt::Write;
use std::path::Path;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_css::workspace_package_name;
use mokly_git::identity::RepoPath;
use mokly_git::repository::Repository;
use mokly_graph::types::RenderGeneration;

use crate::error::{Error, Result};
use crate::working_inputs::ignored_paths;

pub(crate) fn warnings(
    repository: &dyn Repository,
    config: &ResolvedConfig,
    head: &dyn RenderGeneration,
) -> Result<Vec<Warning>> {
    let Some(imports) = head.module_imports() else {
        return Ok(Vec::new());
    };
    let loaded = imports
        .modules
        .into_iter()
        .flat_map(|modules| modules.values().flatten())
        .chain(imports.stylesheet_inputs)
        .map(String::as_str)
        .filter(|path| {
            !Path::new(path).is_absolute()
                && !path.split('/').any(|part| part == "node_modules")
                && RepoPath::parse(path).is_ok()
        })
        .collect();
    let ignored = match ignored_paths(repository, loaded) {
        Ok(ignored) => ignored,
        Err(Error::Cancelled) => return Err(Error::Cancelled),
        Err(error) => {
            tracing::debug!(%error, "ignored module check could not read Git's working paths");
            return Ok(Vec::new());
        }
    };
    let subject = WarningSubject::Configuration(
        config
            .file
            .strip_prefix(&config.repo_root)
            .ok()
            .or_else(|| config.file.file_name().map(Path::new))
            .unwrap_or_else(|| Path::new("mokly.config.json"))
            .to_string_lossy()
            .replace('\\', "/"),
    );
    Ok(ignored
        .into_iter()
        .map(|path| {
            let mut message = format!(
                "module {} is ignored by Git, so a later base cannot load it",
                escape_controls(path)
            );
            if let Some(package) = workspace_package_name(
                imports.tree,
                &config.repo_root,
                &config.repo_root.join(path),
            ) {
                message.push_str("; set moduleResolution.sourcePackages for ");
                message.push_str(&escape_controls(&package));
            }
            Warning {
                code: "ignored-module",
                subject: subject.clone(),
                message,
            }
        })
        .collect())
}

fn escape_controls(value: &str) -> String {
    let mut escaped = String::new();
    for character in value.chars() {
        if character.is_control() {
            let _ = write!(escaped, "\\u{:04x}", u32::from(character));
        } else {
            escaped.push(character);
        }
    }
    escaped
}
