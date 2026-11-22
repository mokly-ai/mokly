//! Frozen head reads retain byte checks while the graph runs global validation.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode};
use mokly_graph::error::Result;
use mokly_graph::head_validation::{HeadValidation, ValidationRead};
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
            ValidationRead::Document => self.document_identity(route, ProofMode::Current),
            ValidationRead::GeneratedContent => {
                self.comparison_identity(ComparisonRead::Resource, route, ProofMode::Current)
            }
            _ => self.inner.validation_identity(kind, route),
        }
    }
}
