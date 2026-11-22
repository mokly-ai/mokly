//! Optional head facts preserve the ordinary complete, ordered validation pass.

use std::sync::Arc;

use crate::cache::Artifact;
use crate::closure::ClosureObserver;
use crate::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode, content_identity};
use crate::error::{GraphError, Result};
use crate::head_validation::{HeadValidation, ValidationRead, public_identity, resource_identity};
use crate::references;
use crate::session::Session;
use crate::types::{RenderGeneration, RenderSummary};
use crate::validation_summary::Summary;
use crate::workers::{DocumentWorker, ValidatedView};

struct Worker<'a> {
    session: &'a Session,
    validation: &'a dyn HeadValidation,
}

impl DocumentWorker for Worker<'_> {
    fn validate(&self, route: &str) -> Result<ValidatedView> {
        self.session.check_cancelled()?;
        let artifact = self.validation.document(route)?;
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| GraphError::InputsChanged { path: route.into() })?;
        let closure = match self
            .validation
            .closure(route, document, &self.session.walker())
        {
            Ok(closure) => closure,
            Err(source) => {
                return Err(GraphError::Attempt {
                    failures: vec![source],
                    warnings: document.warnings.clone(),
                });
            }
        };
        for path in &closure.replay {
            self.session.observe(route, path);
        }
        Ok(ValidatedView {
            route: route.into(),
            anchors: references::anchors(&document.tree),
            links: document.links.clone(),
            closure: closure.files,
            warnings: document
                .warnings
                .iter()
                .chain(&closure.warnings)
                .cloned()
                .collect(),
        })
    }
}

impl Session {
    pub(crate) fn checked_head_document(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.raw(route)?;
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(artifact)
    }

    pub(crate) fn complete_head(&self, validation: &dyn HeadValidation) -> Result<RenderSummary> {
        let routes: Vec<_> = self.state.plans.keys().cloned().collect();
        let mut summary = Summary::new(self);
        for result in self.state.workers.run(
            &routes,
            &Worker {
                session: self,
                validation,
            },
        ) {
            summary.record(result);
        }
        let (summary, views) = summary.finish(self)?;
        for (route, view) in views {
            for path in view.closure {
                self.state
                    .inputs
                    .closures
                    .record(&self.state.plans[&route].key.0, &path);
            }
            self.offer_document(&route);
        }
        Ok(summary)
    }

    pub(crate) fn head_identity(
        &self,
        kind: ValidationRead,
        route: &str,
    ) -> Option<ContentIdentity> {
        match kind {
            ValidationRead::Policy => self.state.comparison_policy,
            ValidationRead::Document => {
                self.input_identity(ComparisonRead::Document, route, ProofMode::Current)
            }
            ValidationRead::PublicTarget => {
                let path = route.strip_prefix("static/")?;
                public_identity(&self.state.policy.check(path))
            }
            ValidationRead::StaticContent | ValidationRead::GeneratedContent => {
                let digest = self.resource_digest(route).ok()?;
                resource_identity(digest.as_deref())
            }
            ValidationRead::GeneratedMembership => {
                let path = route.strip_prefix("static/mokly-generated/")?;
                let document = self.state.plans.contains_key(path);
                let resource = self.state.resources.contains_key(path);
                Some(content_identity(
                    &serde_json::to_vec(&(document, resource)).ok()?,
                ))
            }
        }
    }
}
