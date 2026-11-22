//! Per-entry-module render input keys: every input that can change a module's renders.

use std::collections::BTreeMap;
use std::mem::size_of;
use std::panic::{AssertUnwindSafe, catch_unwind, resume_unwind};
use std::sync::OnceLock;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_catalogue::render_sources::{JavaScriptGeneration, RenderSource, ResolvedDefinition};

use crate::key::NodeKey;
use crate::render_calculation::{self, Built, Mode};
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
    reuse: Option<Box<OnceLock<Option<Facts>>>>,
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
        Self::build_keys(inputs, fallback, None, Mode::Full)
    }

    /// Build the same keys on the supplied render workers with caller tracing context.
    /// Only finished keys remain between exporter jobs.
    pub fn build_with_workers(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: &dyn RenderWorkers,
    ) -> Self {
        Self::build_keys(inputs, fallback, Some(workers), Mode::Full)
    }

    /// Calculate every key and defer Serve-head facts until the generation requests them.
    pub fn build_unseeded_with_workers(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: &dyn RenderWorkers,
    ) -> Self {
        Self::build_keys(inputs, fallback, Some(workers), Mode::Deferred)
    }

    /// Seed Serve-head facts with a full build, or reuse equal preceding entry keys.
    /// The result owns only its current facts; it retains no preceding generation.
    pub fn build_reusing_with_workers(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: &dyn RenderWorkers,
        previous: Option<&Self>,
    ) -> Self {
        Self::build_keys(inputs, fallback, Some(workers), Mode::Reuse(previous))
    }

    #[tracing::instrument(name = "render.inputs", skip_all, fields(
        reused = tracing::field::Empty, recomputed = tracing::field::Empty,
        retained_bytes = tracing::field::Empty
    ))]
    fn build_keys(
        inputs: &RenderInputs<'_>,
        fallback: NodeKey,
        workers: Option<&dyn RenderWorkers>,
        mode: Mode<'_>,
    ) -> Self {
        let keys = match render_calculation::build(inputs, workers, mode) {
            Ok(Built { modules, reuse }) => Self {
                modules,
                fallback,
                reuse,
            },
            Err(error) => {
                tracing::error!(%error, "render inputs could not serialize; using whole-bundle keys");
                Self::whole(fallback)
            }
        };
        tracing::Span::current().record("retained_bytes", keys.reuse_facts_bytes());
        keys
    }

    /// Bytes of the lazy cell and its facts, excluding allocator headers and existing keys.
    /// Ordinary full builders retain no cell and return zero.
    pub fn reuse_facts_bytes(&self) -> usize {
        self.reuse.as_deref().map_or(0, |cell| {
            size_of::<OnceLock<Option<Facts>>>()
                + cell
                    .get()
                    .and_then(Option::as_ref)
                    .map_or(0, Facts::heap_bytes)
        })
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

/// Borrow the same catalogue inputs for full calculation, edit reuse, and deferred seeding.
pub fn with_catalogue_inputs<T>(
    config: &ResolvedConfig,
    catalogue: &PreparedCatalogue,
    generation: &JavaScriptGeneration,
    build: impl FnOnce(&RenderInputs<'_>) -> T,
) -> T {
    let renderer = config.renderer();
    let declarations = catalogue
        .model
        .entries
        .iter()
        .filter_map(|entry| {
            let source = catalogue.javascript.entries.get(&entry.metadata.path)?;
            Some((source.handle.clone(), entry.metadata.source.path.clone()))
        })
        .collect();
    build(&RenderInputs {
        generation,
        bindings: &catalogue.javascript.bindings,
        renderer: renderer.as_deref(),
        entries: &catalogue.javascript.entries,
        declarations: &declarations,
    })
}

impl RenderKeys {
    /// Reading an in-progress initializer returns no evidence and never waits.
    pub(crate) fn completed_facts(&self) -> Option<&Facts> {
        self.reuse.as_deref()?.get()?.as_ref()
    }

    /// A fallback is never reusable as an exporter's own key.
    pub(crate) fn keyed(&self, module: &str) -> Option<&NodeKey> {
        self.modules.get(module)
    }

    /// Initialize only this generation's facts; derive temporary inputs inside the closure.
    pub(crate) fn seed_with(&self, seed: impl FnOnce() -> serde_json::Result<Facts>) {
        if let Some(cell) = self.reuse.as_deref() {
            let mut panic = None;
            cell.get_or_init(|| {
                let span = tracing::info_span!("render.inputs.seed", status = "ok", recomputed = 0, retained_bytes = tracing::field::Empty);
                let _scope = span.enter();
                let facts = match catch_unwind(AssertUnwindSafe(seed)) {
                    Ok(Ok(facts)) => Some(facts),
                    Ok(Err(error)) => {
                        span.record("status", "error");
                        tracing::error!(%error, "render reuse facts could not serialize; keeping full calculations");
                        None
                    }
                    Err(payload) => {
                        span.record("status", "error");
                        panic = Some(payload);
                        None
                    }
                };
                span.record("retained_bytes", size_of::<OnceLock<Option<Facts>>>() + facts.as_ref().map_or(0, Facts::heap_bytes));
                facts
            });
            if let Some(payload) = panic {
                resume_unwind(payload);
            }
        }
    }
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
