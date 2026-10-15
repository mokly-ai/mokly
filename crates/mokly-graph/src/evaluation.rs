//! Evaluate evicted resources and release worker trees after collecting metadata.

use std::sync::Arc;

use crate::cache::Artifact;
use crate::closure::{ClosureBuilder, GeneratedResources};
use crate::error::{GraphError, Result, invalid};
use crate::references;
use crate::session::Session;
use crate::workers::{DocumentWorker, ValidatedView};

impl GeneratedResources for Session {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
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
        let bytes = if let Some(asset) = &plan.asset {
            bundle
                .assets
                .get(asset)
                .cloned()
                .ok_or_else(|| invalid(route, "asset disappeared from its stylesheet recipe"))?
        } else {
            bundle.css.into_bytes()
        };
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
        self.state
            .cache
            .insert(self.state.plans[route].key.clone(), artifact.clone());
        Ok(ValidatedView {
            route: route.into(),
            anchors: references::anchors(&document.tree),
            links: document.links.clone(),
            closure: closure.files,
            warnings: document.warnings.clone(),
        })
    }
}
