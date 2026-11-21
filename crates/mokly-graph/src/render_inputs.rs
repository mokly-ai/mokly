//! Per-entry-module render input keys: every input that can change a module's renders.

use std::collections::{BTreeMap, BTreeSet};

use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderSource, ResolvedDefinition};

use crate::key::NodeKey;
use crate::render_closure::closure;
use crate::render_exporters;
use crate::render_preparation::Prepared;
use crate::render_reuse::Facts;
use crate::workers::RenderWorkers;

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
    reuse: Option<Box<Facts>>,
}

impl RenderKeys {
    /// Keys that give every module the whole-bundle `fallback`.
    pub fn whole(fallback: NodeKey) -> Self {
        Self {
            modules: BTreeMap::new(),
            fallback,
            reuse: None,
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
        Self::build_keys(inputs, fallback, None, false, None)
    }

    /// Build the same keys on the supplied render workers with caller tracing context.
    /// Only finished keys remain between exporter jobs.
    pub fn build_with_workers(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: &dyn RenderWorkers,
    ) -> Self {
        Self::build_keys(inputs, fallback, Some(workers), false, None)
    }

    /// Seed Serve-head facts with a full build, or reuse equal preceding entry keys.
    /// The result owns only its current facts; it retains no preceding generation.
    pub fn build_reusing_with_workers(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: &dyn RenderWorkers,
        previous: Option<&Self>,
    ) -> Self {
        Self::build_keys(inputs, fallback, Some(workers), true, previous)
    }

    #[tracing::instrument(name = "render.inputs", skip_all, fields(
        reused = tracing::field::Empty, recomputed = tracing::field::Empty,
        reuse_bytes = tracing::field::Empty
    ))]
    fn build_keys(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: Option<&dyn RenderWorkers>,
        reusable: bool,
        previous: Option<&Self>,
    ) -> Self {
        match build_modules(inputs, workers, reusable, previous) {
            Ok(Built { modules, reuse }) => Self {
                modules,
                fallback,
                reuse,
            },
            Err(error) => {
                tracing::error!(%error, "render inputs could not serialize; using whole-bundle keys");
                Self::whole(fallback)
            }
        }
    }

    /// Bytes of owned reuse-fact allocations, excluding allocator headers and existing keys.
    /// Full builders retain no facts and return zero.
    pub fn reuse_facts_bytes(&self) -> usize {
        self.reuse.as_deref().map_or(0, Facts::bytes)
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

struct Built {
    modules: BTreeMap<String, NodeKey>,
    reuse: Option<Box<Facts>>,
}

/// Prepare shared closures once and schedule only exporters whose complete inputs may differ.
fn build_modules(
    inputs: &RenderInputs<'_>,
    workers: Option<&dyn RenderWorkers>,
    reusable: bool,
    previous: Option<&RenderKeys>,
) -> serde_json::Result<Built> {
    let graph = &inputs.generation.modules;
    let prepared = Prepared::new(inputs)?;
    let renderer = prepared.records.parts(
        prepared
            .renderer
            .map_or_else(BTreeSet::new, |root| closure(graph, [root.to_owned()])),
    );
    let preview = prepared.records.parts(
        prepared
            .preview
            .map_or_else(BTreeSet::new, |root| closure(graph, [root.to_owned()])),
    );
    let facts = if reusable {
        Some(Box::new(Facts::new(&prepared, &renderer, &preview)?))
    } else {
        None
    };
    let reuse = previous.and_then(|keys| Some((keys, keys.reuse.as_deref()?)));
    let (same_renderer, same_preview) =
        facts
            .as_deref()
            .zip(reuse)
            .map_or((false, false), |(facts, (_, before))| {
                (
                    facts.same_common(before, false),
                    facts.same_common(before, true),
                )
            });
    let affected = if same_renderer || same_preview {
        facts
            .as_deref()
            .zip(reuse)
            .map_or_else(BTreeSet::new, |(facts, (_, before))| {
                facts.affected(before, graph)
            })
    } else {
        BTreeSet::new()
    };
    let mut modules = BTreeMap::new();
    let mut jobs = Vec::new();
    for (module, story) in &prepared.exporters {
        if let Some((facts, (previous, before))) = facts.as_deref().zip(reuse)
            && !affected.contains(module)
            && (if *story { same_preview } else { same_renderer })
            && facts.same_mode(before, module)
            && let Some(key) = previous.modules.get(*module)
        {
            modules.insert((*module).to_owned(), key.clone());
        } else {
            jobs.push((*module, if *story { &preview } else { &renderer }));
        }
    }
    let span = tracing::Span::current();
    span.record("reused", modules.len());
    span.record("recomputed", jobs.len());
    span.record("reuse_bytes", facts.as_deref().map_or(0, Facts::bytes));
    modules.extend(render_exporters::build(
        graph,
        &prepared.records,
        &prepared.shared,
        jobs,
        workers,
    ));
    Ok(Built {
        modules,
        reuse: facts,
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
#[path = "_tests_/render_parallel_tests.rs"]
mod render_parallel_tests;
#[cfg(test)]
#[path = "_tests_/render_reference.rs"]
mod render_reference;
#[cfg(test)]
#[path = "_tests_/render_reuse_tests.rs"]
mod render_reuse_tests;
