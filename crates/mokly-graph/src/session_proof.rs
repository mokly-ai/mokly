//! Content proofs reuse planned recipes and one fixed public-policy identity.

use crate::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode, content_identity};
use crate::session::{Session, SessionInput};
use crate::types::RenderGeneration;

pub(crate) fn policy(input: &SessionInput) -> Option<ContentIdentity> {
    let roots: Vec<_> = input
        .config
        .roots
        .iter()
        .map(|root| (&root.input, &root.directory, &root.identity))
        .collect();
    let encoded = serde_json::to_vec(&(
        &input.config.input,
        &input.config.modules,
        &input.config.file,
        &input.config.repo_root,
        &input.config.authored_inputs,
        roots,
        &input.catalogue.model.sources,
        input.plans.keys().collect::<Vec<_>>(),
        input.resources.keys().collect::<Vec<_>>(),
    ))
    .ok()?;
    Some(content_identity(&encoded))
}

impl Session {
    pub(crate) fn input_identity(
        &self,
        read: ComparisonRead,
        route: &str,
        mode: ProofMode,
    ) -> Option<ContentIdentity> {
        match read {
            ComparisonRead::Document | ComparisonRead::Closure => {
                let plan = self.state.plans.get(route)?;
                let mut bytes = Vec::with_capacity(plan.key.0.len() + 32);
                bytes.extend_from_slice(plan.key.0.as_bytes());
                bytes.extend_from_slice(&self.state.comparison_policy?);
                Some(content_identity(&bytes))
            }
            ComparisonRead::Resource => {
                if let Some(generated) = route.strip_prefix("static/mokly-generated/") {
                    if let Some(plan) = self.state.resources.get(generated) {
                        return Some(content_identity(plan.key.0.as_bytes()));
                    }
                    if self.state.plans.contains_key(generated) {
                        return self.input_identity(ComparisonRead::Document, generated, mode);
                    }
                    return Some(content_identity(b"absent generated resource"));
                }
                if mode == ProofMode::Retained {
                    return None;
                }
                let digest = self.resource_digest(route).ok()?;
                Some(content_identity(&serde_json::to_vec(&digest).ok()?))
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/proof/mod.rs"]
mod proof_tests;
