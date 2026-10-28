//! Per-entry-module render input keys: every input that can change a module's renders.

use std::collections::{BTreeMap, BTreeSet};
use std::iter;

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use mokly_model::material::digest;
use serde_json::{Value, json};

use crate::error::{InternalError, Result};
use crate::key::{NodeKey, NodeKind, data_key};
use crate::render_closure::{chain, closure, handle_module};

/// Storybook preview candidates in the sidecar's selection order.
pub const PREVIEWS: [&str; 6] = [
    ".storybook/preview.tsx",
    ".storybook/preview.ts",
    ".storybook/preview.jsx",
    ".storybook/preview.js",
    ".storybook/preview.mjs",
    ".storybook/preview.cjs",
];

/// The inputs of one side's render input keys.
pub struct RenderInputs<'a> {
    /// The side's bundle: module graph, digests, class maps, resolution files, environment.
    pub generation: &'a JavaScriptGeneration,
    /// Every resolved definition handle with its path and title.
    pub bindings: &'a BTreeMap<String, ResolvedDefinition>,
    /// Logical path of the configured renderer module.
    pub renderer: Option<&'a str>,
    /// Rendering recipes by entry path. A story recipe's module renders with the
    /// Storybook preview and without the renderer.
    pub entries: &'a BTreeMap<String, RenderSource>,
    /// Definition handle to the module that declares the definition. A module that
    /// imports the declaring module reads the binding of a definition that an entry
    /// module only re-exports.
    pub declarations: &'a BTreeMap<String, String>,
}

/// Render input keys by entry module, with the whole-bundle fallback for any other module.
#[derive(Clone, Debug)]
pub struct RenderKeys {
    modules: BTreeMap<String, NodeKey>,
    fallback: NodeKey,
}

impl RenderKeys {
    /// Keys that give every module the whole-bundle `fallback`.
    pub fn whole(fallback: NodeKey) -> Self {
        Self {
            modules: BTreeMap::new(),
            fallback,
        }
    }

    /// Key every module that exports a binding. Other modules use `fallback`.
    pub fn build(inputs: &RenderInputs<'_>, fallback: NodeKey) -> Result<Self> {
        let generation = inputs.generation;
        let graph = &generation.modules;
        let stories: BTreeSet<_> = inputs
            .entries
            .values()
            .filter(|source| source.method == RenderMethod::Story)
            .filter_map(|source| handle_module(graph, &source.handle))
            .collect();
        let records = records(generation)?;
        let chains: BTreeMap<_, _> = graph.keys().map(|path| (path, chain(path))).collect();
        let chained: BTreeSet<&String> = chains.values().flatten().collect();
        let shared: Vec<_> = generation
            .resolution_digests
            .iter()
            .filter(|(name, _)| !chained.contains(name) && !runtime_manifest(generation, name))
            .collect();
        let shared = text_digest(&json!([generation.environment, shared]))?;
        let preview = PREVIEWS
            .iter()
            .find(|candidate| graph.contains_key(**candidate))
            .map(|candidate| closure(graph, [(*candidate).to_owned()]));
        let renderer = inputs
            .renderer
            .map(|renderer| closure(graph, [renderer.to_owned()]));
        // A renderer or preview that the module graph does not name has no content to
        // key, so the modules that render with it keep the whole-bundle fallback.
        let unnamed_renderer = inputs
            .renderer
            .is_some_and(|renderer| !graph.contains_key(renderer));
        let unnamed_preview = PREVIEWS
            .iter()
            .any(|candidate| generation.resolution_digests.contains_key(*candidate));
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
                bindings.entry(module).or_default().push(json!([
                    handle,
                    binding.path,
                    binding.title
                ]));
            }
        }
        let mut modules = BTreeMap::new();
        for module in exporters {
            if (stories.contains(module) && unnamed_preview)
                || (!stories.contains(module) && unnamed_renderer)
            {
                continue;
            }
            let extra = if stories.contains(module) {
                preview.as_ref()
            } else {
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
            )?;
            modules.insert(module.to_owned(), key);
        }
        Ok(Self { modules, fallback })
    }

    /// The whole-bundle key, which every module without its own key uses.
    pub fn fallback(&self) -> &NodeKey {
        &self.fallback
    }

    /// The key of one entry module, or the fallback when it has none.
    pub fn module(&self, module: &str) -> &NodeKey {
        self.modules.get(module).unwrap_or(&self.fallback)
    }

    /// The key of the JavaScript definition at a catalogue path, through its recipe.
    pub fn definition(&self, entries: &BTreeMap<String, RenderSource>, path: &str) -> &NodeKey {
        entries
            .get(path)
            .map_or(&self.fallback, |source| self.handle(&source.handle))
    }

    /// The key of a definition, story, or saved slot handle's entry module.
    pub fn handle(&self, handle: &str) -> &NodeKey {
        handle
            .match_indices('#')
            .rev()
            .map(|(index, _)| &handle[..index])
            .find_map(|module| self.modules.get(module))
            .unwrap_or(&self.fallback)
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
fn records(generation: &JavaScriptGeneration) -> Result<BTreeMap<&String, String>> {
    let mut records = BTreeMap::new();
    for (path, imports) in &generation.modules {
        let content = if path.ends_with(".module.css") {
            generation.class_map_digests.get(path).cloned()
        } else if path.ends_with(".css") {
            None
        } else {
            generation.module_digests.get(path).cloned().flatten()
        };
        records.insert(path, text_digest(&json!([path, imports, content]))?);
    }
    Ok(records)
}

fn text_digest(value: &Value) -> Result<String> {
    match serde_json::to_vec(value) {
        Ok(bytes) => Ok(digest(&bytes)),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/render_bindings_tests.rs"]
mod render_bindings_tests;
#[cfg(test)]
#[path = "_tests_/render_fallback_tests.rs"]
mod render_fallback_tests;
#[cfg(test)]
#[path = "_tests_/render_inputs_tests.rs"]
mod render_inputs_tests;
