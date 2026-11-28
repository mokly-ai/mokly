//! Resolve bindings before using the same composition path for either side.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::delivery_inputs::DeliveryInputs;
use mokly_graph::document_store::Persistence;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::fragments::MemoFragments;
use mokly_graph::graph::Graph;
use mokly_graph::key::NodeKey;
use mokly_graph::render_inputs::with_catalogue_inputs;
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::{DeferredFragments, FragmentRenderer};
use mokly_model::material::digest;
use mokly_sidecar::bindings::{Bindings, EntryBinding};
use mokly_sidecar::methods::Call;

use crate::error::{RenderError, Result};
use crate::fragments::Fragments;
use crate::imported_assets;
use crate::leases::FinishPreparation;
use crate::runtime::Runtime;
use crate::source_lease::LeasedTree;
use crate::stylesheets::StylesheetAttempt;
use crate::{bundle_attempt, bundle_styles, declarations, definition_handle, sources, stylesheets};

pub(crate) struct JavaScriptGraph {
    pub(crate) runtime: Runtime,
}

impl RenderGraph for JavaScriptGraph {
    fn prepare(
        &self,
        config: ResolvedConfig,
        mut catalogue: PreparedCatalogue,
        output: Option<&Path>,
    ) -> mokly_graph::error::Result<Arc<dyn RenderGeneration>> {
        let _preparation = FinishPreparation(catalogue.javascript.generation.as_ref().and_then(
            |generation| {
                self.runtime
                    .prepared
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .get(&generation.css_context)
                    .and_then(Weak::upgrade)
                    .and_then(|prepared| prepared.context.clone())
            },
        ));
        if (config.vite()
            || config.modules.postcss.is_some()
            || catalogue.javascript.generation.is_some())
            && let Some(warning) = self.runtime.base_warning()
            && !catalogue.warnings.contains(&warning)
        {
            catalogue.warnings.push(warning);
        }
        let (graph, attempt) = match self.graph(&config, &mut catalogue) {
            Ok(graph) => graph,
            Err(source) => {
                return Err(GraphError::Attempt {
                    failures: vec![match source.diagnostic() {
                        Some(source) => GraphError::Runtime { source },
                        None => GraphError::Internal(InternalError::Provider {
                            source: Box::new(source),
                        }),
                    }],
                    warnings: catalogue.warnings,
                });
            }
        };
        let warnings = catalogue.warnings.clone();
        let vite_config = config.vite().then(|| config.file.clone());
        match graph.prepare(config, catalogue, output) {
            Ok(generation) => {
                if let Some(file) = vite_config {
                    *self
                        .runtime
                        .vite_inventory
                        .lock()
                        .unwrap_or_else(|error| error.into_inner()) =
                        Some((file, Arc::downgrade(&generation)));
                }
                if self.runtime.serve_head() {
                    attempt.retire_used();
                }
                Ok(generation)
            }
            Err(source) => Err(GraphError::Attempt {
                failures: vec![source],
                warnings,
            }),
        }
    }
}

impl JavaScriptGraph {
    fn graph(
        &self,
        config: &ResolvedConfig,
        catalogue: &mut PreparedCatalogue,
    ) -> Result<(Arc<dyn RenderGraph>, StylesheetAttempt)> {
        let mut side = self.runtime.side(config);
        let assets = sources::reader(&self.runtime, config, &side);
        let mut inputs = DeliveryInputs {
            persistence: None,
            resources: self.runtime.resources.clone(),
            closures: self.runtime.closures.clone(),
            style_references: self.runtime.style_references.clone(),
            dependency_aliases: side.dependency_aliases.clone(),
            render_keys: None,
            stylesheet_roots: Vec::new(),
            story_previews: BTreeMap::new(),
            imported_assets: Vec::new(),
            component_stylesheets: BTreeMap::new(),
            entry_modules: BTreeMap::new(),
        };
        let mut attempt = None;
        let declarations = declarations::validate(self.runtime.tree.clone(), config, catalogue)?;
        let mut fragments: Arc<dyn FragmentRenderer> = Arc::new(DeferredFragments);
        if let Some(generation) = &catalogue.javascript.generation {
            side.context = generation.css_context.clone();
            if let Some(prepared) = self
                .runtime
                .prepared
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .get(&generation.css_context)
                .and_then(Weak::upgrade)
            {
                attempt = Some(StylesheetAttempt {
                    compiler: prepared.compiler.clone(),
                    context: prepared.context.clone(),
                });
            }
            let compiler = attempt
                .get_or_insert_with(|| stylesheets::attempt(&self.runtime, config, &side))
                .compiler
                .as_ref();
            let mut vite_generation;
            let generation = if config.vite()
                && let Some(digest) =
                    bundle_styles::local_input_digest(compiler, config, &declarations)?
            {
                vite_generation = generation.clone();
                vite_generation.environment.push(':');
                vite_generation.environment.push_str(&digest);
                &vite_generation
            } else {
                generation
            };
            let bindings = Bindings {
                generation: generation.id.clone(),
                entries: catalogue
                    .javascript
                    .bindings
                    .iter()
                    .map(|(handle, binding)| {
                        (
                            handle.clone(),
                            EntryBinding {
                                path: binding.path.clone(),
                                title: binding.title.clone(),
                            },
                        )
                    })
                    .collect(),
            };
            match self.runtime.pool.request(Call::Bindings(bindings.clone())) {
                Ok(_) => {}
                Err(source) => return Err(RenderError::Sidecar { source }),
            }
            let table = serde_json::to_vec(&bindings.entries)
                .expect("entry bindings contain only strings and string-keyed maps");
            let mut identity = format!(
                "{}:{}:{}",
                generation.id,
                generation.class_maps_digest,
                digest(&table)
            );
            if config.vite() {
                identity.push(':');
                identity.push_str(&generation.environment);
            }
            let fingerprint = digest(identity.as_bytes());
            let renderer = config.renderer();
            let keys = with_catalogue_inputs(config, catalogue, generation, |inputs| {
                self.runtime.render_keys(inputs, NodeKey(fingerprint))
            });
            fragments = Arc::new(MemoFragments::new(
                keys.clone(),
                Arc::new(Fragments {
                    pool: self.runtime.pool.clone(),
                    generation: generation.id.clone(),
                    source_root: side.source_root.clone(),
                    _lease: generation.lease.clone(),
                }),
                self.runtime.cache.clone(),
            ));
            let entry_modules: BTreeMap<_, _> = catalogue
                .javascript
                .entries
                .iter()
                .map(|(path, source)| {
                    (
                        path.clone(),
                        definition_handle::split(&source.handle).0.to_owned(),
                    )
                })
                .collect();
            let modules: Vec<_> = entry_modules.values().cloned().collect();
            let story_previews = bundle_attempt::story_previews(
                &generation.storybook_previews,
                &generation.modules,
                &config.storybook_folders(&catalogue.inventory.files),
            );
            let stylesheet_roots = bundle_styles::prepare_roots(
                compiler,
                bundle_styles::ModuleRoots {
                    modules: &generation.modules,
                    renderer: renderer.as_deref(),
                    entries: &modules,
                    previews: &story_previews,
                    loaders: &side.module_resolution.loaders,
                    vite: config.vite(),
                },
            )?;
            inputs = DeliveryInputs {
                persistence: None,
                resources: self.runtime.resources.clone(),
                closures: self.runtime.closures.clone(),
                style_references: self.runtime.style_references.clone(),
                dependency_aliases: side.dependency_aliases.clone(),
                render_keys: Some(keys),
                stylesheet_roots,
                story_previews,
                component_stylesheets: declarations,
                imported_assets: imported_assets::prepare(
                    assets.as_ref(),
                    &config.repo_root,
                    generation,
                )?,
                entry_modules,
            };
        }
        inputs.persistence = self
            .runtime
            .document_store
            .as_ref()
            .map(|store| Persistence {
                store: store.clone(),
                javascript: catalogue
                    .javascript
                    .generation
                    .as_ref()
                    .and_then(|generation| generation.persistence_identity.clone()),
            });
        let attempt = attempt.unwrap_or_else(|| stylesheets::attempt(&self.runtime, config, &side));
        let graph: Arc<dyn RenderGraph> = Arc::new(Graph {
            inputs,
            tree: Arc::new(LeasedTree {
                tree: self.runtime.tree.clone(),
                assets,
                _base: self.runtime.base.clone(),
            }),
            composer: Arc::new(HtmlComposer { fragments }),
            stylesheets: attempt.compiler.clone(),
            cache: self.runtime.cache.clone(),
            workers: self.runtime.workers.clone(),
            version: self.runtime.version.clone(),
        });
        Ok((graph, attempt))
    }
}
