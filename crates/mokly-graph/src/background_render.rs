//! Prepare each root once, then compose on the existing render workers.

use std::mem;
use std::sync::{Arc, Mutex};

use mokly_html::error::HtmlError;
use mokly_html::prepared_root::PreparedRoot;
use mokly_model::catalogue::{EntryContent, ModelEntry};

use crate::background::Completion;
use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder};
use crate::error::{GraphError, InternalError, Result, invalid};
use crate::session::Session;
use crate::session_persistence::DocumentLookup;
use crate::session_render::record_axes;
use crate::types::RenderGeneration;
use crate::workers::ArtifactWorker;
use crate::{document_composition, fragment_weight};

impl Session {
    /// Classify dispatch from immutable metadata without preparing or reading the cache.
    pub(crate) fn background_root_eligible(&self, route: &str) -> bool {
        let Some(plan) = self.state.plans.get(route) else {
            return false;
        };
        let Some(entry) = self.state.catalogue.model.entries.get(plan.entry) else {
            return false;
        };
        preparation_allowed(entry)
            && self
                .state
                .composer
                .can_prepare_root(&self.state.catalogue, entry)
    }

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
        let lookup =
            if self.state.cache.contains(&plan.key) || !self.background_root_eligible(route) {
                None
            } else {
                Some(self.background_lookup(route))
            };
        let prepared = if lookup
            .as_ref()
            .is_some_and(DocumentLookup::allows_preparation)
        {
            let request = document_composition::request(self, plan, entry);
            match self.state.composer.prepare_root(&request) {
                Ok(prepared) => prepared,
                Err(source) => return Err(composition_error(route, &entry.metadata.path, source)),
            }
        } else {
            None
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
                    .saturating_add(lookup.as_ref().map_or(0, DocumentLookup::retained_bytes))
                    .saturating_add(mem::size_of::<BackgroundJob<'_>>())
                    .saturating_add(completion.metadata_bytes());
                completion.handoff(bytes);
                Some(prepared)
            }
            None => None,
        };
        let job = BackgroundJob {
            session: self,
            attempt: Mutex::new(Some(BackgroundAttempt { prepared, lookup })),
        };
        self.state.workers.document(route, &job)
    }
}

fn preparation_allowed(entry: &ModelEntry) -> bool {
    !matches!(entry.content, EntryContent::Document { .. })
}

struct BackgroundJob<'a> {
    session: &'a Session,
    attempt: Mutex<Option<BackgroundAttempt>>,
}

struct BackgroundAttempt {
    prepared: Option<PreparedRoot>,
    lookup: Option<DocumentLookup>,
}

impl ArtifactWorker for BackgroundJob<'_> {
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let attempt = self
            .attempt
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
            .ok_or(InternalError::PreparedRootConsumed)?;
        let composed = self
            .session
            .raw_prepared(route, attempt.prepared, attempt.lookup)?;
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
