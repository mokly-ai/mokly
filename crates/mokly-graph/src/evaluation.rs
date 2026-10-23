//! Evaluate evicted resources and release worker trees after collecting metadata.

use std::sync::Arc;

use crate::asset_delivery::AssetRead;
use crate::cache::Artifact;
use crate::closure::{ClosureBuilder, GeneratedResources};
use crate::error::{GraphError, Result, invalid};
use crate::session::Session;
use crate::session_collection;
use crate::types::ComparisonDocument;
use crate::workers::{DocumentWorker, ValidatedView};

impl GeneratedResources for Session {
    fn open_asset(&self, route: &str) -> Result<Option<Box<dyn AssetRead>>> {
        self.open_asset_input(route)
    }
    fn contains_resource(&self, route: &str) -> Result<bool> {
        Ok(self.state.resources.contains_key(route))
    }

    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(mut asset) = self.open_asset(route)? {
            return Ok(Some(asset.read_bytes()?));
        }

        let Some(plan) = self.state.resources.get(route) else {
            return Ok(None);
        };
        if let Some(artifact) = self.state.cache.get(&plan.key) {
            return Ok(Some(artifact.bytes.clone()));
        }
        let bundle = match self.state.stylesheets.bundle(&plan.root) {
            Ok(bundle) => bundle,
            Err(source) => return Err(GraphError::Css { source }),
        };
        let bytes = bundle.css.into_bytes();
        self.state.cache.insert(
            plan.key.clone(),
            Arc::new(Artifact {
                bytes: bytes.clone(),
                document: None,
                fragment: None,
                content_type: plan.content_type.clone(),
            }),
        );
        Ok(Some(bytes))
    }
    fn is_document(&self, route: &str) -> bool {
        self.state.plans.contains_key(route)
    }
}

impl DocumentWorker for Session {
    fn validate(&self, route: &str) -> Result<ValidatedView> {
        session_collection::view(route, &self.validation_input(route, false)?)
    }
}

impl Session {
    pub(crate) fn validation_input(
        &self,
        route: &str,
        capture: bool,
    ) -> Result<ComparisonDocument> {
        let artifact = {
            let span =
                capture.then(|| tracing::info_span!("review.capture-document", status = "error"));
            let _scope = span.as_ref().map(tracing::Span::enter);
            let artifact = self.raw(route)?;
            if let Some(span) = &span {
                span.record("status", "ok");
            }
            artifact
        };
        let document = artifact
            .document
            .as_ref()
            .ok_or_else(|| invalid(route, "document has no composed tree"))?;
        let closure = {
            let span =
                capture.then(|| tracing::info_span!("review.capture-closure", status = "error"));
            let _scope = span.as_ref().map(tracing::Span::enter);
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
            if let Some(span) = &span {
                span.record("status", "ok");
            }
            closure
        };
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(ComparisonDocument { artifact, closure })
    }
}
