//! Configuration schema and semantic validation shared with the editor schema.

use std::collections::{BTreeMap, BTreeSet};

use jsonschema::error::ValidationErrorKind;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::SourceLocation;
use serde_json::Value;

use crate::config_types::{Config, SourcePackage, SourcePackages};
use crate::diagnostic::{Code, Issue};
use crate::error::{CatalogueError, Result};
use crate::locations::{at, json_positions};
use crate::{config_postcss, globs};

/// Exact schema shipped by the public package; no schema is fetched at runtime.
pub const CONFIG_SCHEMA: &str = include_str!("../../../packages/mokly/config.schema.json");

/// Parse a data-only config, reject unknown fields, and normalize ordered sets.
pub fn parse(text: &str, path: &str) -> Result<Config> {
    let value: Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(error) => return Err(json_error(path, &error, format!("invalid JSON: {error}"))),
    };
    config_postcss::shape(&value)?;
    let schema: Value = serde_json::from_str(CONFIG_SCHEMA)
        .expect("the embedded configuration schema is valid JSON");
    let validator = jsonschema::draft202012::options()
        .build(&schema)
        .expect("the embedded configuration schema is valid JSON Schema");
    if let Err(error) = validator.validate(&value) {
        let pointer = error.instance_path().as_str();
        let positions = json_positions(text);
        let (field, message) = match error.kind() {
            ValidationErrorKind::AdditionalProperties { unexpected } => {
                let name = unexpected.first().cloned().unwrap_or_default();
                (
                    format!("{pointer}/{name}"),
                    format!("unknown configuration field: {name}"),
                )
            }
            _ => (pointer.into(), format!("{}: {error}", setting(pointer))),
        };
        return Err(CatalogueError::Config(
            Issue::new(Code::ConfigInvalid, message).at(at(
                path,
                text,
                positions.get(&field).copied().unwrap_or(0),
            )),
        ));
    }
    let mut config: Config = match serde_json::from_value(value) {
        Ok(config) => config,
        Err(error) => return Err(invalid(format!("{path}: {error}"))),
    };
    if let Some(roots) = &config.roots {
        let mut directories = BTreeSet::new();
        for (index, root) in roots.iter().enumerate() {
            if !directories.insert(&root.dir) {
                return Err(invalid(format!(
                    "roots[{index}].dir: duplicate directory {}",
                    root.dir
                )));
            }
            if let Some(files) = &root.files
                && let Err(reason) = globs::compile(files)
            {
                return Err(invalid(format!("roots[{index}].files: {reason}")));
            }
        }
    }
    let mut matches = BTreeSet::new();
    for (index, rule) in config.stylesheets.iter().flatten().enumerate() {
        if !matches.insert(&rule.r#match) {
            return Err(invalid(format!(
                "stylesheets[{index}].match: duplicate match {}",
                rule.r#match
            )));
        }
    }
    let mut watch_paths = BTreeSet::new();
    for rule in config
        .watch
        .iter()
        .flat_map(|watch| watch.rules.iter().flatten())
    {
        if let Err(reason) = globs::compile(&rule.paths) {
            return Err(invalid(format!("watch.rules.paths: {reason}")));
        }
        for path in &rule.paths {
            if !watch_paths.insert(path) {
                return Err(invalid(format!(
                    "watch.rules.paths: duplicate watch path {path}"
                )));
            }
        }
    }
    let schemes = config
        .color_schemes
        .get_or_insert_with(|| vec![ColorScheme::Light]);
    schemes.sort();
    if let Some(module) = &mut config.module_resolution {
        if let Some(packages) = &mut module.source_packages {
            normalize_source_packages(packages, path, text)?;
        }
        for values in [
            &mut module.conditions,
            &mut module.main_fields,
            &mut module.resolve_extensions,
        ]
        .into_iter()
        .flatten()
        {
            let mut seen = BTreeSet::new();
            values.retain(|value| seen.insert(value.clone()));
        }
    }
    Ok(config)
}

fn normalize_source_packages(packages: &mut SourcePackages, path: &str, text: &str) -> Result<()> {
    for (package, entry) in packages {
        let SourcePackage::Folders(folders) = entry else {
            continue;
        };
        let mut normalized = BTreeMap::new();
        for (build, source) in &*folders {
            let directory = source_folder(build);
            if let Some((previous, _)) = normalized.insert(directory.clone(), (build, source)) {
                let package_key = package.replace('~', "~0").replace('/', "~1");
                let folder_key = build.replace('~', "~0").replace('/', "~1");
                let pointer =
                    format!("/moduleResolution/sourcePackages/{package_key}/{folder_key}");
                let position = json_positions(text).get(&pointer).copied().unwrap_or(0);
                let message = format!(
                    "moduleResolution.sourcePackages[{package:?}]: duplicate build folder {directory:?} from {previous:?} and {build:?}"
                );
                return Err(CatalogueError::Config(
                    Issue::new(Code::ConfigInvalid, message).at(at(path, text, position)),
                ));
            }
        }
        *folders = normalized
            .into_iter()
            .map(|(build, (_, source))| (build, source_folder(source)))
            .collect();
    }
    Ok(())
}

fn source_folder(path: &str) -> String {
    let path = path
        .split('/')
        .filter(|part| !matches!(*part, "" | "."))
        .collect::<Vec<_>>()
        .join("/");
    if path.is_empty() { ".".into() } else { path }
}

fn json_error(path: &str, error: &serde_json::Error, message: String) -> CatalogueError {
    CatalogueError::Config(Issue::new(Code::ConfigInvalid, message).at(SourceLocation {
        path: path.into(),
        line: error.line(),
        column: error.column(),
        export: None,
    }))
}

pub(crate) fn invalid(message: impl Into<String>) -> CatalogueError {
    CatalogueError::Config(Issue::new(Code::ConfigInvalid, message))
}

fn setting(pointer: &str) -> String {
    let mut text = String::new();
    for part in pointer.trim_start_matches('/').split('/') {
        if part.bytes().all(|c| c.is_ascii_digit()) && !part.is_empty() {
            text.push_str(&format!("[{part}]"));
        } else {
            if !text.is_empty() {
                text.push('.');
            }
            text.push_str(part);
        }
    }
    if text.is_empty() {
        "configuration".into()
    } else {
        text
    }
}

#[cfg(test)]
#[path = "_tests_/config_tests.rs"]
mod config_tests;
