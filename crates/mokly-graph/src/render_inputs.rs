//! Per-entry-module render input keys: every input that can change a module's renders.

use std::collections::{BTreeMap, BTreeSet, btree_map::Entry};
use std::iter;

use mokly_catalogue::render_sources::{
    JavaScriptGeneration, RenderMethod, RenderSource, ResolvedDefinition,
};
use mokly_model::material::digest;
use serde_json::to_vec;

use crate::key::NodeKey;
use crate::render_closure::{Records, additional, chain, closure, handle_module};

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
    ///
    /// Every key of the side shares the environment, the resolution files on no module
    /// chain, and the bindings of the unattributed definitions, because no closure shows
    /// which modules read them. A preview digest stays only for a preview that the graph
    /// does not name. The stories then use `fallback`, which covers the preview, and the
    /// shared part leaves the digest out.
    pub fn build(inputs: &RenderInputs<'_>, fallback: NodeKey) -> Self {
        let modules = match build_modules(inputs) {
            Ok(modules) => modules,
            Err(error) => {
                tracing::error!(%error, "render inputs could not serialize; using whole-bundle keys");
                BTreeMap::new()
            }
        };
        Self { modules, fallback }
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

/// Prepare shared closures once and merge only each exporter's additional records.
fn build_modules(inputs: &RenderInputs<'_>) -> serde_json::Result<BTreeMap<String, NodeKey>> {
    let generation = inputs.generation;
    let graph = &generation.modules;
    let stories: BTreeSet<_> = inputs
        .entries
        .values()
        .filter(|source| source.method == RenderMethod::Story)
        .filter_map(|source| handle_module(graph, &source.handle))
        .collect();
    let mut records = records(generation)?;
    let chained: BTreeSet<&String> = records.chains.values().flatten().collect();
    let shared: Vec<_> = generation
        .resolution_digests
        .iter()
        .filter(|(name, _)| {
            !chained.contains(name)
                && !runtime_manifest(generation, name)
                && !PREVIEWS.contains(&name.as_str())
        })
        .collect();
    let unattributed: Vec<_> = inputs
        .bindings
        .iter()
        .filter(|(handle, _)| generation.unattributed.contains(*handle))
        .map(|(handle, binding)| (handle, &binding.path, &binding.title))
        .collect();
    let shared = digest(&to_vec(&(&generation.environment, shared, unattributed))?);
    let unnamed_renderer = inputs
        .renderer
        .is_some_and(|renderer| !graph.contains_key(renderer));
    let unnamed_preview = PREVIEWS
        .iter()
        .any(|candidate| generation.resolution_digests.contains_key(*candidate));
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
        let encoded = to_vec(&(handle, &binding.path, &binding.title))?;
        for module in iter::once(exporter).chain(declarer) {
            records
                .bindings
                .entry(module)
                .or_default()
                .push(encoded.clone());
        }
    }
    let preview = records.parts(
        PREVIEWS
            .iter()
            .find(|candidate| graph.contains_key(**candidate))
            .map_or_else(BTreeSet::new, |candidate| {
                closure(graph, [(*candidate).to_owned()])
            }),
    );
    let renderer = records.parts(inputs.renderer.map_or_else(BTreeSet::new, |renderer| {
        closure(graph, [renderer.to_owned()])
    }));
    let mut modules = BTreeMap::new();
    for module in exporters {
        let story = stories.contains(module);
        if (story && unnamed_preview) || (!story && unnamed_renderer) {
            continue;
        }
        let common = if story { &preview } else { &renderer };
        let extra = records.parts(additional(graph, [module.to_owned()], &common.members));
        modules.insert(module.to_owned(), common.key(&extra, &shared));
    }
    Ok(modules)
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

/// Encode every module and resolution record once, including explicit missing imports.
fn records(generation: &JavaScriptGeneration) -> serde_json::Result<Records<'_>> {
    let mut modules = BTreeMap::new();
    for (path, imports) in &generation.modules {
        let content = if path.ends_with(".module.css") {
            generation.class_map_digests.get(path)
        } else if path.ends_with(".css") {
            None
        } else {
            generation.module_digests.get(path).and_then(Option::as_ref)
        };
        let record = digest(&to_vec(&(path, imports, content))?);
        modules.insert(path.as_str(), to_vec(&(path, Some(record)))?);
    }
    for path in generation.modules.values().flatten() {
        if let Entry::Vacant(entry) = modules.entry(path.as_str()) {
            entry.insert(to_vec(&(path, Option::<&str>::None))?);
        }
    }
    let resolution = generation
        .resolution_digests
        .iter()
        .map(|(name, value)| Ok((name.as_str(), to_vec(&(name, value))?)))
        .collect::<serde_json::Result<_>>()?;
    let chains = generation
        .modules
        .keys()
        .map(|path| (path.as_str(), chain(path)))
        .collect();
    Ok(Records {
        modules,
        resolution,
        chains,
        bindings: BTreeMap::new(),
    })
}

#[cfg(test)]
#[path = "_tests_/render_bindings_tests.rs"]
mod render_bindings_tests;
#[cfg(test)]
#[path = "_tests_/render_equivalence_tests.rs"]
mod render_equivalence_tests;
#[cfg(test)]
#[path = "_tests_/render_fallback_tests.rs"]
mod render_fallback_tests;
#[cfg(test)]
#[path = "_tests_/render_inputs_tests.rs"]
mod render_inputs_tests;
#[cfg(test)]
#[path = "_tests_/render_reference.rs"]
mod render_reference;
