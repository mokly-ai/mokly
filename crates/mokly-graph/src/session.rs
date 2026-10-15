//! On-demand document evaluation and eviction-safe resource reconstruction.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::normalize_warnings;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::types::StylesheetBundler;
use mokly_html::composition::{ComposeRequest, Composer};
use mokly_html::error::HtmlError;
use mokly_model::axes::Viewport;
use mokly_model::catalogue::EntryContent;
use mokly_source_interface::tree::SourceTree;

use crate::cache::{Artifact, RenderCache};
use crate::closure::{Closure, ClosureBuilder, Walker};
use crate::delivery_inputs::DeliveryInputs;
use crate::error::{GraphError, Result, invalid};
use crate::graph::Graph;
use crate::policy::PublicPolicy;
use crate::reference_index::{MemoryReferenceIndex, ReferenceIndex};
use crate::types::{DocumentPlan, RenderGeneration, RenderSummary, ResourcePlan};
use crate::workers::RenderWorkers;
use crate::{markdown_links, rendering, route_inventory, styles, validation};

#[derive(Clone)]
pub(crate) struct Session {
    pub(crate) state: Arc<State>,
}

pub(crate) struct State {
    pub(crate) reference_index: Arc<dyn ReferenceIndex>,
    pub(crate) inputs: DeliveryInputs,
    pub(crate) config: ResolvedConfig,
    pub(crate) catalogue: PreparedCatalogue,
    pub(crate) plans: BTreeMap<String, DocumentPlan>,
    pub(crate) resources: BTreeMap<String, ResourcePlan>,
    pub(crate) tree: Arc<dyn SourceTree>,
    pub(crate) composer: Arc<dyn Composer>,
    pub(crate) stylesheets: Arc<dyn StylesheetBundler>,
    pub(crate) cache: Arc<dyn RenderCache>,
    pub(crate) workers: Arc<dyn RenderWorkers>,
    pub(crate) policy: Arc<dyn PublicPolicy>,
}

impl Session {
    pub(crate) fn new(
        config: ResolvedConfig,
        catalogue: PreparedCatalogue,
        plans: BTreeMap<String, DocumentPlan>,
        resources: BTreeMap<String, ResourcePlan>,
        graph: &Graph,
        policy: Arc<dyn PublicPolicy>,
    ) -> Self {
        Self {
            state: Arc::new(State {
                reference_index: Arc::new(MemoryReferenceIndex::default()),
                inputs: graph.inputs.clone(),
                config,
                catalogue,
                plans,
                resources,
                tree: graph.tree.clone(),
                composer: graph.composer.clone(),
                stylesheets: graph.stylesheets.clone(),
                cache: graph.cache.clone(),
                workers: graph.workers.clone(),
                policy,
            }),
        }
    }

    pub(crate) fn raw(&self, route: &str) -> Result<Arc<Artifact>> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        if let Some(artifact) = self.state.cache.get(&plan.key) {
            return Ok(artifact);
        }
        let entry = &self.state.catalogue.model.entries[plan.entry];
        let mut composed = if matches!(entry.content, EntryContent::Document { .. }) {
            let resolver = markdown_links::Resolver {
                tree: self.state.tree.clone(),
                config: &self.state.config,
                catalogue: &self.state.catalogue,
                entry,
                route,
                policy: self.state.policy.as_ref(),
            };
            rendering::markdown(&self.state.catalogue, entry, plan, &resolver)?
        } else {
            match self.state.composer.compose(&ComposeRequest {
                catalogue: &self.state.catalogue,
                entry,
                viewport: plan.viewport.unwrap_or(Viewport::Desktop),
                color_scheme: plan.color_scheme,
                stylesheets: plan.stylesheets.clone(),
            }) {
                Ok(composed) => composed,
                Err(source) => {
                    return Err(GraphError::Html {
                        source: HtmlError::Route {
                            route: route.into(),
                            source: Box::new(source),
                        },
                    });
                }
            }
        };
        if plan.viewport.is_some() {
            let parent = entry
                .metadata
                .variant_of
                .as_ref()
                .unwrap_or(&entry.metadata.path);
            let hrefs = styles::links(&styles::LinkInput {
                config: &self.state.config,
                path: &entry.metadata.path,
                route,
                scheme: plan.color_scheme,
                components: &composed.components,
                inputs: &self.state.inputs,
                resources: &self.state.resources,
                module: self
                    .state
                    .inputs
                    .entry_modules
                    .get(parent)
                    .map_or(entry.metadata.source.path.as_str(), String::as_str),
            })?;
            styles::install(&mut composed.tree, &hrefs);
        }
        rendering::finish(composed, plan, entry, &self.state.catalogue.model.entries)
    }

    pub(crate) fn walker(&self) -> Walker {
        Walker {
            tree: self.state.tree.clone(),
            policy: self.state.policy.clone(),
            generated: Arc::new(self.clone()),
            index: self.state.reference_index.clone(),
        }
    }
}

impl RenderGeneration for Session {
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        &self.state.plans
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        &self.state.catalogue
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.raw(route)?;
        if let Some(document) = &artifact.document {
            validation::links(self, &document.links)?;
        }
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(artifact)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        self.read_resource(route)
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.raw(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
        if let Err(source) = self
            .walker()
            .collect(route, &document.tree, &document.resources)
        {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: document.warnings.clone(),
            });
        }
        if let Err(source) = validation::links(self, &document.links) {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: document.warnings.clone(),
            });
        }
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(artifact)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        let artifact = self.render(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
        self.walker()
            .collect(route, &document.tree, &document.resources)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        let routes: Vec<_> = self.state.plans.keys().cloned().collect();
        let results = self.state.workers.run(&routes, self);
        let mut summary = RenderSummary {
            documents: routes.len(),
            warnings: self.state.catalogue.warnings.clone(),
            ..Default::default()
        };
        let mut failures = Vec::new();
        let mut views = BTreeMap::new();
        for result in results {
            match result {
                Ok(view) => {
                    summary.closure.extend(view.closure.clone());
                    summary.warnings.extend(view.warnings.clone());
                    views.insert(view.route.clone(), view);
                }
                Err(source) => failures.push(source),
            }
        }
        if !failures.is_empty() {
            return Err(GraphError::Attempt {
                failures,
                warnings: summary.warnings,
            });
        }
        if let Err(source) = validation::completed(self, &views) {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: summary.warnings,
            });
        }
        let mut names = route_inventory::RouteInventory::default();
        for path in &summary.closure {
            if let Err(source) = names.insert(path, true) {
                return Err(GraphError::Attempt {
                    failures: vec![source],
                    warnings: summary.warnings,
                });
            }
        }
        normalize_warnings(&mut summary.warnings);
        Ok(summary)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.state.resources.keys().cloned().collect()
    }
}
