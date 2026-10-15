//! Public component stylesheets are checked before any document render.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::policy::FilePolicy;
use mokly_source_interface::tree::SourceTree;

use crate::error::{InternalError, RenderError, Result};

pub(crate) fn validate(
    tree: Arc<dyn SourceTree>,
    config: &ResolvedConfig,
    catalogue: &mut PreparedCatalogue,
) -> Result<BTreeMap<String, Vec<String>>> {
    let policy = match FilePolicy::new(
        tree.clone(),
        config,
        &catalogue.model.sources,
        BTreeMap::new(),
        None,
    ) {
        Ok(policy) => policy,
        Err(source) => {
            return Err(RenderError::Graph {
                source: Box::new(source),
            });
        }
    };
    let directory = config.file.parent().unwrap_or(&config.repo_root);
    let configured: BTreeSet<_> = config
        .input
        .stylesheets
        .iter()
        .flatten()
        .flat_map(|rule| {
            rule.stylesheets
                .iter()
                .chain(rule.light_stylesheets.iter().flatten())
                .chain(rule.dark_stylesheets.iter().flatten())
        })
        .map(|path| relative(&directory.join(path), &config.repo_root))
        .collect();
    let mut declarations = BTreeMap::new();
    for entry in catalogue
        .model
        .entries
        .iter()
        .filter(|entry| entry.metadata.variant_of.is_none())
    {
        let Some(render) = catalogue.javascript.entries.get(&entry.metadata.path) else {
            continue;
        };
        let mut seen = BTreeSet::new();
        let mut paths = Vec::new();
        for path in &render.stylesheets {
            if path.is_empty()
                || path.starts_with('/')
                || path.contains(['\\', ':', '?', '#', '\0'])
                || path.split('/').any(|part| matches!(part, "" | "." | ".."))
                || !path.to_ascii_lowercase().ends_with(".css")
            {
                return Err(RenderError::StylesheetPath {
                    component: entry.metadata.path.clone(),
                    path: path.clone(),
                });
            }
            let logical = relative(&directory.join(path), &config.repo_root);
            if let Err(source) = policy.stylesheet_input(&logical, configured.contains(&logical)) {
                return Err(RenderError::StylesheetPolicy {
                    component: entry.metadata.path.clone(),
                    path: path.clone(),
                    source,
                });
            }
            let node = match tree.project(&config.repo_root.join(&logical)) {
                Ok(Some(node)) => node,
                Ok(None) => {
                    return Err(RenderError::StylesheetPath {
                        component: entry.metadata.path.clone(),
                        path: path.clone(),
                    });
                }
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            if !seen.insert(node.identity) {
                catalogue.warnings.push(Warning {
                    code: "duplicate-component-stylesheet",
                    subject: WarningSubject::Component(entry.metadata.path.clone()),
                    message: format!(
                        "duplicate component stylesheet {} is ignored; it is linked once.",
                        serde_json::Value::String(path.clone())
                    ),
                });
            } else {
                paths.push(path.clone());
            }
        }
        if !paths.is_empty() {
            declarations.insert(entry.metadata.path.clone(), paths);
        }
    }
    Ok(declarations)
}
