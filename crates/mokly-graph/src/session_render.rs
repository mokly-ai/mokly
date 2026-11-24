//! Render saved or temporary props and publish validated closure membership.

use std::sync::{Arc, Weak};

use mokly_model::axes::Viewport;

use crate::cache::Artifact;
use crate::closure::{Closure, ClosureBuilder, ClosureObserver, Walker};
use crate::error::{GraphError, Result};
use crate::head_validation::{ClosureFacts, Unrecorded, ValidationRecorder};
use crate::head_walks::{PassRecorder, WalkRecord};
use crate::session::Session;
use crate::session_lookup::DocumentRead;
use crate::types::DocumentPlan;
use crate::viewer_fonts::ViewerFonts;
use crate::workers::ArtifactWorker;
use crate::{resource_digests, validation};

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

    /// The viewer-face permission of a planned route's entry; an unplanned route has none.
    pub(crate) fn viewer_fonts(&self, route: &str) -> ViewerFonts {
        self.state
            .plans
            .get(route)
            .and_then(|plan| self.state.catalogue.model.entries.get(plan.entry))
            .map_or(ViewerFonts::Denied, |entry| ViewerFonts::of(&entry.content))
    }

    #[tracing::instrument(
        name = "render.document",
        skip_all,
        fields(viewport, scheme, cache_hit = false),
        err
    )]
    pub(crate) fn raw(&self, route: &str) -> Result<Arc<Artifact>> {
        match self.raw_lookup(route)? {
            DocumentRead::Hit(artifact) => Ok(artifact),
            DocumentRead::Miss(key) => self.compose_miss(route, key, None),
        }
    }

    pub(crate) fn finish_artifact(
        &self,
        route: &str,
        composed: Arc<Artifact>,
        finish: Finish,
    ) -> Result<Arc<Artifact>> {
        let recorder = (finish == Finish::Background && self.state.plans[route].viewport.is_some())
            .then(|| PassRecorder::new(self));
        let walk: &dyn ValidationRecorder = match &recorder {
            Some(recorder) => recorder,
            None => &Unrecorded,
        };
        let document = composed
            .document
            .as_ref()
            .expect("rendered document artifacts carry their composed tree");
        let closure = match self.walker().collect_recorded(
            route,
            &document.tree,
            &document.resources,
            self.viewer_fonts(route),
            walk,
        ) {
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
        if let Some(steps) = recorder.and_then(PassRecorder::finish) {
            let closure = ClosureFacts {
                files: closure.files,
                warnings: closure.warnings,
                replay: Vec::new(),
            };
            self.state
                .walks
                .insert(route, WalkRecord { steps, closure });
        }
        Ok(artifact)
    }
}

/// Whether a finished view keeps the read set of its closure walk for its generation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Finish {
    /// A foreground read keeps no walk record.
    Foreground,
    /// A background read of a view with a viewport keeps one for the head validation of its
    /// generation. A page or a Markdown document keeps none, because the pass reads it again
    /// after each edit, also when its document did not change.
    Background,
}

impl ArtifactWorker for Session {
    fn closure_job(&self, route: &str) -> Result<Closure> {
        let artifact = self.artifact(route)?;
        let document = artifact
            .document
            .as_ref()
            .expect("rendered document artifacts carry their composed tree");
        self.walker().collect(
            route,
            &document.tree,
            &document.resources,
            self.viewer_fonts(route),
        )
    }
    fn artifact(&self, route: &str) -> Result<Arc<Artifact>> {
        let composed = self.raw(route)?;
        self.finish_artifact(route, composed, Finish::Foreground)
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
