//! Render saved or temporary props and publish validated closure membership.

use std::sync::{Arc, Weak};

use mokly_html::prepared_root::PreparedRoot;
use mokly_model::axes::Viewport;

use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder, ClosureObserver, Walker};
use crate::document_store::ReadOutcome;
use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::session_persistence::DocumentLookup;
use crate::types::DocumentPlan;
use crate::workers::ArtifactWorker;
use crate::{document_composition, resource_digests, validation};

impl Session {
    pub(crate) fn preview_walker(&self) -> Walker {
        Walker {
            observer: None,
            ..self.walker()
        }
    }

    pub(crate) fn walker(&self) -> Walker {
        Walker {
            observer: Some(Arc::new(self.clone())),
            tree: self.state.tree.clone(),
            policy: self.state.policy.clone(),
            generated: Arc::new(self.clone()),
            index: self.state.reference_index.clone(),
        }
    }

    #[tracing::instrument(
        name = "render.document",
        skip_all,
        fields(viewport, scheme, cache_hit = false),
        err
    )]
    pub(crate) fn raw(&self, route: &str) -> Result<Arc<Artifact>> {
        self.raw_prepared(route, None, None)
    }

    pub(crate) fn raw_prepared(
        &self,
        route: &str,
        prepared: Option<PreparedRoot>,
        lookup: Option<DocumentLookup>,
    ) -> Result<Arc<Artifact>> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
        record_axes(plan);
        let cached = self.state.cache.get(&plan.key);
        if let Some(artifact) = cached {
            tracing::Span::current().record("cache_hit", true);
            return Ok(artifact);
        }
        let (stored_key, read_store) = match lookup {
            Some(DocumentLookup::Read(key)) => (key, true),
            Some(DocumentLookup::Miss(key)) => (key, false),
            None => (self.stored_key(route), true),
        };
        if let (Some(key), Some(persistence)) = (&stored_key, &self.state.inputs.persistence)
            && read_store
            && let ReadOutcome::Hit(artifact) | ReadOutcome::HitWithStoreFault(artifact) =
                persistence.store.load(key)
        {
            self.state
                .composer
                .record_served(&document_composition::request(
                    self,
                    plan,
                    &self.state.catalogue.model.entries[plan.entry],
                ));
            return Ok(artifact);
        }
        let entry = &self.state.catalogue.model.entries[plan.entry];
        let result = document_composition::document(self, plan, entry, prepared);
        match result {
            Ok(artifact) => {
                if let Some(key) = stored_key {
                    self.state
                        .fresh
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .insert(plan.key.0.clone(), key);
                }
                Ok(artifact)
            }
            Err(source) => Err(GraphError::Document {
                entry: entry.metadata.path.clone(),
                source: Box::new(source),
            }),
        }
    }

    pub(crate) fn finish_artifact(
        &self,
        route: &str,
        composed: Arc<Artifact>,
    ) -> Result<Arc<Artifact>> {
        let document = composed
            .document
            .as_ref()
            .expect("rendered document artifacts carry their composed tree");
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
        let artifact = with_closure_warnings(composed.clone(), &closure);
        let document = artifact
            .document
            .as_ref()
            .expect("rendered document artifacts carry their composed tree");
        if let Err(source) = validation::links(self, &document.links) {
            return Err(GraphError::Attempt {
                failures: vec![source],
                warnings: document.warnings.clone(),
            });
        }
        // Both sides share cache entries, so the entry keeps only the composition.
        // Each read adds the closure warnings of its own side's sources.
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), composed);
        let key = &self.state.plans[route].key.0;
        for path in &closure.files {
            self.state.inputs.closures.record(key, path);
        }
        self.offer_document(route);
        Ok(artifact)
    }
}

impl ArtifactWorker for Session {
    fn closure_job(&self, route: &str) -> Result<Closure> {
        let artifact = self.artifact(route)?;
        let document = artifact
            .document
            .as_ref()
            .expect("rendered document artifacts carry their composed tree");
        self.walker()
            .collect(route, &document.tree, &document.resources)
    }
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let composed = self.raw(route)?;
        self.finish_artifact(route, composed)
    }
}

/// Adds the closure's warnings to the document's own warnings, once each.
///
/// The closure walk raises warnings that composition cannot see, such as the
/// stylesheet-owner warning for a renderer seed. Serve and the props preview report
/// only the document's warnings, so the view's report needs both lists.
pub(crate) fn with_closure_warnings(artifact: Arc<Artifact>, closure: &Closure) -> Arc<Artifact> {
    let document = artifact
        .document
        .as_ref()
        .expect("closure warnings are added only to rendered document artifacts");
    let added: Vec<_> = closure
        .warnings
        .iter()
        .filter(|warning| !document.warnings.contains(warning))
        .cloned()
        .collect();
    if added.is_empty() {
        return artifact;
    }
    let mut document = document.clone();
    document.warnings.extend(added);
    Arc::new(Artifact {
        document: Some(document),
        ..(*artifact).clone()
    })
}

impl ClosureObserver for Session {
    fn observe(&self, route: &str, path: &str) {
        if let Some(plan) = self.state.plans.get(route) {
            let digest = resource_digests::confined(
                self.state.tree.as_ref(),
                &self.state.config.repo_root,
                path,
            );
            self.state
                .inputs
                .resources
                .record(&plan.resource_key, path, digest);
        }
        let added = self
            .state
            .observed
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(path.into());
        if added {
            let observer = self
                .state
                .observer
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_ref()
                .and_then(Weak::upgrade);
            if let Some(observer) = observer {
                observer.observe(&self.state.generation_key, path);
            }
        }
    }
}

pub(crate) fn record_axes(plan: &DocumentPlan) {
    tracing::Span::current().record(
        "viewport",
        match plan.viewport {
            Some(Viewport::Mobile) => "mobile",
            Some(Viewport::Desktop) => "desktop",
            None => "none",
        },
    );
    tracing::Span::current().record(
        "scheme",
        match plan.color_scheme {
            mokly_model::axes::ColorScheme::Light => "light",
            mokly_model::axes::ColorScheme::Dark => "dark",
        },
    );
}
