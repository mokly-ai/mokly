//! Render saved or temporary props and publish validated closure membership.

use std::sync::{Arc, Weak};

use mokly_model::axes::Viewport;

use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder, ClosureObserver};
use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::workers::ArtifactWorker;
use crate::{document_composition, resource_digests, validation};

impl Session {
    #[tracing::instrument(
        name = "render.document",
        skip_all,
        fields(viewport, scheme, cache_hit = false),
        err
    )]
    pub(crate) fn raw(&self, route: &str) -> Result<Arc<Artifact>> {
        let plan = self
            .state
            .plans
            .get(route)
            .ok_or_else(|| invalid(route, "document route is absent from this generation"))?;
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
        if let Some(artifact) = self.state.cache.get(&plan.key) {
            tracing::Span::current().record("cache_hit", true);
            return Ok(artifact);
        }
        let entry = &self.state.catalogue.model.entries[plan.entry];
        let result = document_composition::document(self, plan, entry);
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
        let composed = self.raw(route)?;
        let document = composed
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
        let artifact = with_closure_warnings(composed.clone(), &closure);
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
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
        Ok(artifact)
    }
}

/// Adds the closure's warnings to the document's own warnings, once each.
///
/// The closure walk raises warnings that composition cannot see, such as the
/// stylesheet-owner warning for a renderer seed. Serve and the props preview report
/// only the document's warnings, so the view's report needs both lists.
pub(crate) fn with_closure_warnings(artifact: Arc<Artifact>, closure: &Closure) -> Arc<Artifact> {
    let Some(document) = &artifact.document else {
        return artifact;
    };
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
