//! Frozen head reads retain byte checks while the graph runs global validation.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode};
use mokly_graph::error::Result;
use mokly_graph::head_validation::{DocumentChecks, HeadValidation, ValidationRead};
use mokly_graph::types::{RenderGeneration, RenderSummary};
use mokly_model::material::digest;
use mokly_model::namespace::generated;

use crate::comparison_graph::FrozenResources;

impl FrozenResources {
    pub(crate) fn checked_head(&self, route: &str) -> Result<Arc<Artifact>> {
        let artifact = self.inner.validation_document(route)?;
        self.check(&generated(route), Some(digest(&artifact.bytes)))?;
        Ok(artifact)
    }

    pub(crate) fn head_summary(&self, validation: &dyn HeadValidation) -> Result<RenderSummary> {
        self.inner.validate_head(validation)
    }

    pub(crate) fn head_input(&self, kind: ValidationRead, route: &str) -> Option<ContentIdentity> {
        match kind {
            ValidationRead::GeneratedContent => {
                self.comparison_identity(ComparisonRead::Resource, route, ProofMode::Current)
            }
            _ => self.inner.validation_identity(kind, route),
        }
    }

    /// Export the frozen digest of this route's checked head read.
    pub(crate) fn head_checks(&self, route: &str) -> Option<DocumentChecks> {
        self.inner.validation_checks(route)?;
        let digest = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&generated(route))?
            .clone()?;
        Some(DocumentChecks {
            digest: Some(digest),
        })
    }

    /// Freeze a proven document's kept digest, unless this state froze another one.
    pub(crate) fn adopt_head(&self, route: &str, checks: &DocumentChecks) -> bool {
        let Some(digest) = &checks.digest else {
            return false;
        };
        let route_key = generated(route);
        let frozen = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&route_key)
            .cloned();
        if frozen
            .as_ref()
            .is_some_and(|frozen| frozen.as_ref() != Some(digest))
        {
            return false;
        }
        if !self
            .inner
            .adopt_validation(route, &DocumentChecks::default())
        {
            return false;
        }
        self.check(&route_key, Some(digest.clone())).is_ok()
    }
}
