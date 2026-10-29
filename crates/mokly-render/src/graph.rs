//! Resolve bindings before using the same composition path for either side.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::delivery_inputs::DeliveryInputs;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::fragments::MemoFragments;
use mokly_graph::graph::Graph;
use mokly_graph::key::NodeKey;
use mokly_graph::render_inputs::{RenderInputs, RenderKeys};
use mokly_graph::types::{RenderGeneration, RenderGraph};
use mokly_html::composition::HtmlComposer;
use mokly_html::fragment::{DeferredFragments, FragmentRenderer};
use mokly_model::material::digest;
use mokly_sidecar::bindings::{Bindings, EntryBinding};
use mokly_sidecar::methods::Call;
use mokly_sidecar::wire::MethodResult;

use crate::declarations;
use crate::error::{self, RenderError, Result};
use crate::fragments::Fragments;
use crate::runtime::Runtime;
use crate::source_lease::LeasedTree;
use crate::{sources, stylesheets};

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
        if (config.input.postcss.is_some() || catalogue.javascript.generation.is_some())
            && let Some(warning) = self.runtime.base_warning()
            && !catalogue.warnings.contains(&warning)
        {
            catalogue.warnings.push(warning);
        }
        let graph = match self.graph(&config, &mut catalogue) {
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
        match graph.prepare(config, catalogue, output) {
            Ok(generation) => Ok(generation),
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
    ) -> Result<Arc<dyn RenderGraph>> {
        let mut side = self.runtime.side(config)?;
        let mut inputs = DeliveryInputs {
            resources: self.runtime.resources.clone(),
            closures: self.runtime.closures.clone(),
            dependency_aliases: side.dependency_aliases.clone(),
            ..Default::default()
        };
        let mut compiler = None;
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
                compiler = Some(prepared.compiler.clone());
            }
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
                Ok(MethodResult::Empty) => {}
                Ok(_) => return Err(RenderError::ResultKind { method: "bindings" }),
                Err(source) => return Err(RenderError::Sidecar { source }),
            }
            let table = match serde_json::to_vec(&bindings.entries) {
                Ok(bytes) => bytes,
                Err(source) => return Err(error::InternalError::Json { source }.into()),
            };
            let fingerprint = digest(
                format!(
                    "{}:{}:{}",
                    generation.id,
                    generation.class_maps_digest,
                    digest(&table)
                )
                .as_bytes(),
            );
            let renderer = config.renderer();
            let declaring: BTreeMap<_, _> = catalogue
                .model
                .entries
                .iter()
                .filter_map(|entry| {
                    let source = catalogue.javascript.entries.get(&entry.metadata.path)?;
                    Some((source.handle.clone(), entry.metadata.source.path.clone()))
                })
                .collect();
            let keys = match RenderKeys::build(
                &RenderInputs {
                    generation,
                    bindings: &catalogue.javascript.bindings,
                    renderer: renderer.as_deref(),
                    entries: &catalogue.javascript.entries,
                    declarations: &declaring,
                },
                NodeKey(fingerprint),
            ) {
                Ok(keys) => Arc::new(keys),
                Err(source) => {
                    return Err(RenderError::Graph {
                        source: Box::new(source),
                    });
                }
            };
            fragments = Arc::new(MemoFragments::new(
                keys.clone(),
                Arc::new(Fragments {
                    pool: self.runtime.pool.clone(),
                    generation: generation.id.clone(),
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
                        source
                            .handle
                            .split('#')
                            .next()
                            .unwrap_or(&source.handle)
                            .to_owned(),
                    )
                })
                .collect();
            let modules: Vec<_> = entry_modules.values().cloned().collect();
            inputs = DeliveryInputs {
                resources: self.runtime.resources.clone(),
                closures: self.runtime.closures.clone(),
                dependency_aliases: side.dependency_aliases.clone(),
                render_keys: Some(keys),
                stylesheet_roots: stylesheets::roots(
                    &generation.modules,
                    renderer.as_deref(),
                    &modules,
                    &side.module_resolution.loaders,
                ),
                component_stylesheets: declarations,
                entry_modules,
            };
        }
        Ok(Arc::new(Graph {
            inputs,
            tree: Arc::new(LeasedTree {
                tree: self.runtime.tree.clone(),
                assets: sources::reader(&self.runtime, config, &side),
                _base: self.runtime.base.clone(),
            }),
            composer: Arc::new(HtmlComposer { fragments }),
            stylesheets: compiler
                .unwrap_or_else(|| stylesheets::compiler(&self.runtime, config, &side)),
            cache: self.runtime.cache.clone(),
            workers: self.runtime.workers.clone(),
            version: self.runtime.version.clone(),
        }))
    }
}
