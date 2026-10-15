//! Render saved or temporary props and publish validated closure membership.

use std::borrow::Cow;
use std::sync::Arc;

use mokly_html::composition::ComposeRequest;
use mokly_html::error::HtmlError;
use mokly_model::axes::Viewport;
use mokly_model::catalogue::EntryContent;

use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder};
use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::workers::ArtifactWorker;
use crate::{markdown_links, rendering, styles, validation};

impl Session {
    pub(crate) fn raw(&self, route: &str) -> Result<Arc<Artifact>> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        if let Some(artifact) = self.state.cache.get(&plan.key) {
            return Ok(artifact);
        }
        let saved = &self.state.catalogue.model.entries[plan.entry];
        let entry = match &self.state.temporary_props {
            Some((index, props)) if *index == plan.entry => {
                let mut edited = saved.clone();
                if let EntryContent::Screen { visual, .. }
                | EntryContent::Component { visual, .. } = &mut edited.content
                {
                    visual.props = props.clone();
                }
                Cow::Owned(edited)
            }
            _ => Cow::Borrowed(saved),
        };
        let entry = entry.as_ref();
        let result = (|| -> Result<Arc<Artifact>> {
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
                    matchers: &self.state.matchers,
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
            rendering::finish(composed, plan, entry, &self.state.catalogue)
        })();
        match result {
            Ok(artifact) => Ok(artifact),
            Err(source) => Err(GraphError::Document {
                entry: entry.metadata.path.clone(),
                source: Box::new(source),
            }),
        }
    }
}

impl ArtifactWorker for Session {
    fn closure_job(&self, route: &str) -> Result<Closure> {
        let artifact = self.artifact(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
        self.walker()
            .collect(route, &document.tree, &document.resources)
    }
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.raw(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
        let closure = match self
            .walker()
            .collect(route, &document.tree, &document.resources)
        {
            Ok(closure) => closure,
            Err(source) => {
                return Err(GraphError::Attempt {
                    failures: vec![source],
                    warnings: document.warnings.clone(),
                });
            }
        };
        if let Err(source) = validation::links(self, &document.links) {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: document.warnings.clone(),
            });
        }
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        self.state
            .public_files
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .extend(closure.files);
        Ok(artifact)
    }
}
