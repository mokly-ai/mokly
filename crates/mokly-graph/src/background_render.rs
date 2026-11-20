//! Prepare each root once, then compose on the existing render workers.

use std::mem;
use std::sync::{Arc, Mutex};

use mokly_html::composition::ComposeRequest;
use mokly_html::error::HtmlError;
use mokly_html::prepared_root::PreparedRoot;
use mokly_model::axes::Viewport;
use mokly_model::catalogue::EntryContent;

use crate::background::Completion;
use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder};
use crate::error::{GraphError, InternalError, Result, invalid};
use crate::fragment_weight;
use crate::session::Session;
use crate::session_render::record_axes;
use crate::types::RenderGeneration;
use crate::workers::ArtifactWorker;

impl Session {
    #[tracing::instrument(
        name = "render.document",
        skip_all,
        fields(viewport, scheme, cache_hit = false),
        err
    )]
    pub(crate) fn background_document(
        &self,
        route: &str,
        completion: Arc<dyn Completion>,
    ) -> Result<Arc<Artifact>> {
        self.check_cancelled()?;
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        record_axes(plan);
        let entry = &self.state.catalogue.model.entries[plan.entry];
        let prepared = if self.state.cache.contains(&plan.key)
            || matches!(entry.content, EntryContent::Document { .. })
        {
            None
        } else {
            let request = ComposeRequest {
                catalogue: &self.state.catalogue,
                entry,
                viewport: plan.viewport.unwrap_or(Viewport::Desktop),
                color_scheme: plan.color_scheme,
                stylesheets: plan.stylesheets.clone(),
            };
            match self.state.composer.prepare_root(&request) {
                Ok(prepared) => prepared,
                Err(source) => return Err(composition_error(route, &entry.metadata.path, source)),
            }
        };
        let prepared = match prepared {
            Some(prepared) => {
                let prepared = match prepared.into_ready() {
                    Ok(prepared) => prepared,
                    Err(source) => {
                        return Err(composition_error(route, &entry.metadata.path, source));
                    }
                };
                let bytes = prepared
                    .input_bytes()
                    .saturating_add(prepared.fragment().map_or(0, fragment_weight::retained))
                    .saturating_add(mem::size_of::<BackgroundJob<'_>>())
                    .saturating_add(completion.metadata_bytes());
                completion.handoff(bytes);
                Some(Mutex::new(Some(prepared)))
            }
            None => None,
        };
        let job = BackgroundJob {
            session: self,
            prepared,
        };
        self.state.workers.document(route, &job)
    }
}

struct BackgroundJob<'a> {
    session: &'a Session,
    prepared: Option<Mutex<Option<PreparedRoot>>>,
}

impl ArtifactWorker for BackgroundJob<'_> {
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let prepared = match &self.prepared {
            Some(prepared) => Some(
                prepared
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .take()
                    .ok_or(InternalError::PreparedRootConsumed)?,
            ),
            None => None,
        };
        let composed = self.session.raw_prepared(route, prepared)?;
        self.session.finish_artifact(route, composed)
    }
    fn closure_job(&self, route: &str) -> Result<Closure> {
        let artifact = self.artifact(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or(InternalError::PreparedRootConsumed)?;
        self.session
            .walker()
            .collect(route, &document.tree, &document.resources)
    }
}

fn composition_error(route: &str, entry: &str, source: HtmlError) -> GraphError {
    GraphError::Document {
        entry: entry.into(),
        source: Box::new(GraphError::Html {
            source: HtmlError::Route {
                route: route.into(),
                source: Box::new(source),
            },
        }),
    }
}
