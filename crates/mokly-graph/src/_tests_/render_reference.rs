//! Reference render input algorithm retained to prove byte-identical keys.

use std::collections::{BTreeMap, BTreeSet};
use std::iter;

use mokly_catalogue::config_types::DEFAULT_STORYBOOK_FOLDER;
use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderMethod};
use mokly_model::material::digest;
use serde_json::{Value, json};

use crate::key::{NodeKey, NodeKind, data_key};
use crate::render_closure::{chain, handle_module};

use super::{RenderInputs, RenderKeys, preview_candidates};

/// Run the original per-entry closure, resolution union, and JSON hashing algorithm.
pub(super) fn build(inputs: &RenderInputs<'_>, fallback: NodeKey) -> RenderKeys {
    let generation = inputs.generation;
    let graph = &generation.modules;
    let stories: BTreeMap<_, _> = inputs
        .entries
        .values()
        .filter(|source| source.method == RenderMethod::Story)
        .filter_map(|source| handle_module(graph, &source.handle))
        .map(|module| {
            (
                module,
                inputs
                    .storybook_folders
                    .get(module)
                    .map_or(DEFAULT_STORYBOOK_FOLDER, String::as_str),
            )
        })
        .collect();
    let candidates: BTreeSet<_> = stories
        .values()
        .copied()
        .chain(inputs.storybook_folders.values().map(String::as_str))
        .flat_map(preview_candidates)
        .collect();
    let records = records(generation);
    let chains: BTreeMap<_, _> = graph.keys().map(|path| (path, chain(path))).collect();
    let chained: BTreeSet<&String> = chains.values().flatten().collect();
    let shared: Vec<_> = generation
        .resolution_digests
        .iter()
        .filter(|(name, _)| {
            !chained.contains(name)
                && !runtime_manifest(generation, name)
                && !candidates.contains(*name)
        })
        .collect();
    let unattributed: Vec<_> = inputs
        .bindings
        .iter()
        .filter(|(handle, _)| generation.unattributed.contains(*handle))
        .map(|(handle, binding)| json!([handle, binding.path, binding.title]))
        .collect();
    let shared = text_digest(&json!([generation.environment, shared, unattributed]));
    let renderer = inputs
        .renderer
        .map(|renderer| closure(graph, [renderer.to_owned()]));
    // A renderer or preview that the module graph does not name has no content to
    // key, so the modules that render with it keep the whole-bundle fallback.
    let unnamed_renderer = inputs
        .renderer
        .is_some_and(|renderer| !graph.contains_key(renderer));
    let mut bindings: BTreeMap<&str, Vec<Value>> = BTreeMap::new();
    let mut exporters = BTreeSet::new();
    for (handle, binding) in inputs.bindings {
        let Some(exporter) = handle_module(graph, handle) else {
            continue;
        };
        exporters.insert(exporter);
        let declarer = inputs
            .declarations
            .get(handle)
            .map(String::as_str)
            .filter(|module| *module != exporter && graph.contains_key(*module));
        for module in iter::once(exporter).chain(declarer) {
            bindings
                .entry(module)
                .or_default()
                .push(json!([handle, binding.path, binding.title]));
        }
    }
    let mut modules = BTreeMap::new();
    for module in exporters {
        let preview;
        let extra = if let Some(folder) = stories.get(module) {
            preview = match generation.storybook_previews.get(*folder) {
                Some(Some(path)) if graph.contains_key(path) => {
                    Some(closure(graph, [path.clone()]))
                }
                Some(_) => continue,
                None => None,
            };
            preview.as_ref()
        } else {
            if unnamed_renderer {
                continue;
            }
            renderer.as_ref()
        };
        let mut members = closure(graph, [module.to_owned()]);
        members.extend(extra.into_iter().flatten().cloned());
        let resolution: BTreeSet<_> = members
            .iter()
            .filter_map(|path| chains.get(path))
            .flatten()
            .filter_map(|name| generation.resolution_digests.get_key_value(name))
            .collect();
        let exported: Vec<_> = members
            .iter()
            .filter_map(|path| bindings.get(path.as_str()))
            .flatten()
            .collect();
        let key = data_key(
            NodeKind::RenderInputs,
            json!({
                "shared": shared,
                "modules": members.iter().map(|path| (path, records.get(path))).collect::<Vec<_>>(),
                "resolution": resolution,
                "bindings": exported,
            }),
        );
        modules.insert(module.to_owned(), key);
    }
    RenderKeys {
        modules,
        fallback,
        reuse: None,
    }
}

/// Whether a name is the manifest of a runtime package other than React.
///
/// The environment identifies runtime packages by their resolved paths. Only React's
/// manifest also enters every key, because both sides record it. A side can record the
/// other manifests while it resolves them, so they count only on a module chain.
fn runtime_manifest(generation: &JavaScriptGeneration, name: &str) -> bool {
    name.strip_suffix("/package.json").is_some_and(|directory| {
        generation
            .runtime_packages
            .iter()
            .filter(|package| package.as_str() != "react")
            .any(|package| {
                directory
                    .strip_suffix(package.as_str())
                    .is_some_and(dependency_root)
            })
    })
}

/// Whether a logical prefix ends with a dependency root: a `node_modules` directory or
/// a further selected root, `node_modules/.mokly-roots/{index}`.
fn dependency_root(prefix: &str) -> bool {
    prefix.ends_with("node_modules/")
        || prefix
            .strip_suffix('/')
            .and_then(|prefix| prefix.rsplit_once("node_modules/.mokly-roots/"))
            .is_some_and(|(_, index)| !index.is_empty() && !index.contains('/'))
}

/// One digest per module: its path, its ordered imports, and its content value.
fn records(generation: &JavaScriptGeneration) -> BTreeMap<&String, String> {
    let mut records = BTreeMap::new();
    for (path, imports) in &generation.modules {
        let content = if path.ends_with(".module.css") {
            generation.class_map_digests.get(path).cloned()
        } else if path.ends_with(".css") {
            None
        } else {
            generation.module_digests.get(path).cloned().flatten()
        };
        records.insert(path, text_digest(&json!([path, imports, content])));
    }
    records
}

fn text_digest(value: &Value) -> String {
    let bytes =
        serde_json::to_vec(value).expect("JSON values with string object keys always serialize");
    digest(&bytes)
}

fn closure(
    modules: &BTreeMap<String, Vec<String>>,
    roots: impl IntoIterator<Item = String>,
) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut stack: Vec<String> = roots.into_iter().collect();
    while let Some(module) = stack.pop() {
        if !found.insert(module.clone()) {
            continue;
        }
        if let Some(imports) = modules.get(&module) {
            stack.extend(
                imports
                    .iter()
                    .filter(|import| !found.contains(*import))
                    .cloned(),
            );
        }
    }
    found
}
