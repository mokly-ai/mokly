//! Worker-first reads retain only captured miss metadata across batch admission.

use std::mem;
use std::sync::{Arc, Mutex};

use mokly_html::error::HtmlError;
use mokly_html::prepared_root::PreparedRoot;
use mokly_model::catalogue::EntryContent;
use tracing::{Span, field};

use crate::background::{BackgroundMiss, BackgroundRead, BackgroundWorker, Completion};
use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder};
use crate::document_store::StoreKey;
use crate::error::{GraphError, InternalError, Result};
use crate::session::Session;
use crate::session_lookup::DocumentRead;
use crate::types::RenderGeneration;
use crate::workers::ArtifactWorker;
use crate::{document_composition, fragment_weight};

impl Session {
    pub(crate) fn read_background_document(&self, route: &str) -> Result<BackgroundRead> {
        let span = tracing::info_span!(
            "render.document",
            viewport = field::Empty,
            scheme = field::Empty,
            cache_hit = false
        );
        span.in_scope(|| {
            let result = self
                .state
                .workers
                .background(route, &Read { session: self });
            if let Err(source) = &result {
                tracing::error!(error = %source);
            }
            result
        })
    }

    pub(crate) fn background_root_eligible(&self, route: &str) -> bool {
        let Some(plan) = self.state.plans.get(route) else {
            return false;
        };
        let Some(entry) = self.state.catalogue.model.entries.get(plan.entry) else {
            return false;
        };
        !matches!(entry.content, EntryContent::Document { .. })
            && self
                .state
                .composer
                .can_prepare_root(&self.state.catalogue, entry)
    }

    fn prepare_background_root(&self, route: &str) -> Result<Option<PreparedRoot>> {
        let plan = &self.state.plans[route];
        let entry = &self.state.catalogue.model.entries[plan.entry];
        let request = document_composition::request(self, plan, entry);
        match self.state.composer.prepare_root(&request) {
            Ok(Some(prepared)) => match prepared.into_ready() {
                Ok(prepared) => Ok(Some(prepared)),
                Err(source) => Err(composition_error(route, &entry.metadata.path, source)),
            },
            Ok(None) => Ok(None),
            Err(source) => Err(composition_error(route, &entry.metadata.path, source)),
        }
    }
}

struct Read<'a> {
    session: &'a Session,
}

impl BackgroundWorker for Read<'_> {
    fn read(&self, route: &str) -> Result<BackgroundRead> {
        self.session.check_cancelled()?;
        match self.session.raw_lookup(route)? {
            DocumentRead::Hit(artifact) => self
                .session
                .finish_artifact(route, artifact)
                .map(BackgroundRead::Complete),
            DocumentRead::Miss(key) => Ok(BackgroundRead::Miss(Box::new(Miss {
                session: self.session.clone(),
                route: route.into(),
                key,
                eligible: self.session.background_root_eligible(route),
                span: Span::current(),
            }))),
        }
    }
}

struct Miss {
    session: Session,
    route: String,
    key: Option<StoreKey>,
    eligible: bool,
    span: Span,
}

impl BackgroundMiss for Miss {
    fn root_eligible(&self) -> bool {
        self.eligible
    }

    fn complete(self: Box<Self>, completion: Option<Arc<dyn Completion>>) -> Result<Arc<Artifact>> {
        let span = self.span.clone();
        span.in_scope(|| {
            let result = (*self).finish(completion);
            if let Err(source) = &result {
                tracing::error!(error = %source);
            }
            result
        })
    }
}

impl Miss {
    fn finish(self, completion: Option<Arc<dyn Completion>>) -> Result<Arc<Artifact>> {
        self.session.check_cancelled()?;
        let prepared = if self.eligible && completion.is_some() {
            self.session.prepare_background_root(&self.route)?
        } else {
            None
        };
        if let (Some(prepared), Some(completion)) = (&prepared, completion) {
            let bytes = prepared
                .input_bytes()
                .saturating_add(prepared.fragment().map_or(0, fragment_weight::retained))
                .saturating_add(self.key.as_ref().map_or(0, |key| key.0.capacity()))
                .saturating_add(self.route.capacity())
                .saturating_add(mem::size_of::<Self>())
                .saturating_add(mem::size_of::<Prepared<'_>>())
                .saturating_add(completion.metadata_bytes());
            completion.handoff(bytes);
        }
        let Miss {
            session,
            route,
            key,
            ..
        } = self;
        let job = Prepared {
            session: &session,
            attempt: Mutex::new(Some(Attempt { prepared, key })),
        };
        session.state.workers.document(&route, &job)
    }
}

struct Prepared<'a> {
    session: &'a Session,
    attempt: Mutex<Option<Attempt>>,
}

struct Attempt {
    prepared: Option<PreparedRoot>,
    key: Option<StoreKey>,
}

impl ArtifactWorker for Prepared<'_> {
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let attempt = self
            .attempt
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
            .ok_or(InternalError::PreparedRootConsumed)?;
        let composed = self
            .session
            .compose_miss(route, attempt.key, attempt.prepared)?;
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
