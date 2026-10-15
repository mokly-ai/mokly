//! Configuration schema and semantic validation shared with the editor schema.

use std::collections::BTreeSet;

use jsonschema::error::ValidationErrorKind;
use mokly_model::axes::ColorScheme;
use mokly_model::paths::{is_entry_path, is_path_segment};
use serde_json::Value;

use crate::config_types::Config;
use crate::diagnostic::{Code, Issue};
use crate::error::{CatalogueError, InternalError, Result};
use crate::globs;
use crate::locations::{at, json_positions};

/// Exact schema shipped by the public package; no schema is fetched at runtime.
pub const CONFIG_SCHEMA: &str = include_str!("../../../packages/mokly/config.schema.json");

/// Parse a data-only config, reject unknown fields, and normalize ordered sets.
pub fn parse(text: &str, path: &str) -> Result<Config> {
    let value: Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(error) => {
            return Err(CatalogueError::Config(
                Issue::new(
                    Code::ConfigInvalid,
                    format!("{path}: invalid JSON: {error}"),
                )
                .at(mokly_model::catalogue::SourceLocation {
                    path: path.into(),
                    line: error.line(),
                    column: error.column(),
                    export: None,
                }),
            ));
        }
    };
    let schema: Value = match serde_json::from_str(CONFIG_SCHEMA) {
        Ok(schema) => schema,
        Err(source) => {
            return Err(CatalogueError::Internal(InternalError::Json { source }));
        }
    };
    let validator = match jsonschema::draft202012::options().build(&schema) {
        Ok(validator) => validator,
        Err(error) => return Err(invalid(format!("configuration schema: {error}"))),
    };
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
            if root
                .path
                .as_deref()
                .is_some_and(|path| !is_entry_path(path))
            {
                return Err(invalid(format!("roots[{index}].path is not a valid path")));
            }
            if root
                .transparent
                .iter()
                .flatten()
                .any(|name| !is_path_segment(name))
            {
                return Err(invalid(format!(
                    "roots[{index}].transparent is not an array of valid segments"
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
