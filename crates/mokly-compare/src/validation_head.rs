//! Current checked head documents feed optional closure proofs before pairing.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::cache::Artifact;
use mokly_graph::closure::ClosureBuilder;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, DocumentProof, ProofMode};
use mokly_graph::error::Result;
use mokly_graph::head_validation::{ClosureFacts, HeadValidation, ValidationRead};
use mokly_graph::types::RenderGeneration;
use mokly_html::composition::Composed;

use crate::reuse_budget::Resident;
use crate::reuse_digest;
use crate::validation_recording::Recording;

pub(crate) struct Head {
    pub(crate) generation: Arc<dyn RenderGeneration>,
    pub(crate) resident: Arc<Resident>,
    pub(crate) previous: Option<usize>,
    pub(crate) current: Option<usize>,
    pub(crate) documents: AtomicUsize,
    pub(crate) reused: AtomicUsize,
    pub(crate) walks: AtomicUsize,
    pub(crate) proofs: Mutex<BTreeMap<String, DocumentProof>>,
    pub(crate) policy: Option<ContentIdentity>,
    forward: bool,
}

impl HeadValidation for Head {
    fn document(&self, route: &str) -> Result<Arc<Artifact>> {
        self.documents.fetch_add(1, Ordering::Relaxed);
        let artifact = self.generation.validation_document(route)?;
        if self.forward
            && let Some(identity) = self.generation.comparison_identity(
                ComparisonRead::Document,
                route,
                ProofMode::Retained,
            )
        {
            let proof = DocumentProof {
                identity,
                usage: artifact
                    .document
                    .as_ref()
                    .map(|document| document.usage.clone()),
            };
            self.proofs
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert(route.into(), proof);
        }
        Ok(artifact)
    }

    fn closure(
        &self,
        route: &str,
        document: &Composed,
        builder: &dyn ClosureBuilder,
    ) -> Result<ClosureFacts> {
        let key = self.policy.and_then(|policy| {
            reuse_digest::digest(&(&self.generation.plans().get(route)?.key.0, policy))
        });
        let saved = self
            .resident
            .with_optional([self.previous, self.current], |arenas| {
                let Some(previous) = arenas[0] else {
                    return Ok(None);
                };
                let Some(key) = key else {
                    return Ok(None);
                };
                previous.reuse(
                    arenas[1],
                    &self.resident,
                    self.generation.as_ref(),
                    route,
                    key,
                    builder,
                )
            })?;
        if let Some(saved) = saved {
            self.reused.fetch_add(1, Ordering::Relaxed);
            return Ok(saved);
        }
        self.walks.fetch_add(1, Ordering::Relaxed);
        self.resident.with_optional([self.current, None], |arenas| {
            if let Some(arena) = arenas[0] {
                arena.begin(&self.resident, route);
            }
        });
        let closure = builder.collect_recorded(
            route,
            &document.tree,
            &document.resources,
            &Recording {
                resident: &self.resident,
                arena: self.current,
                generation: self.generation.as_ref(),
                route,
            },
        )?;
        let closure = ClosureFacts {
            files: closure.files,
            warnings: closure.warnings,
            replay: vec![],
        };
        self.resident.with_optional([self.current, None], |arenas| {
            if let Some(arena) = arenas[0] {
                arena.finish(route, key, &closure);
            }
        });
        Ok(closure)
    }
}

impl Head {
    pub(crate) fn new(
        generation: Arc<dyn RenderGeneration>,
        resident: Arc<Resident>,
        previous: Option<usize>,
        current: Option<usize>,
        forward: bool,
    ) -> Self {
        let policy = generation.validation_identity(ValidationRead::Policy, "");
        Self {
            generation,
            resident,
            previous,
            current,
            documents: AtomicUsize::new(0),
            reused: AtomicUsize::new(0),
            walks: AtomicUsize::new(0),
            proofs: Mutex::new(BTreeMap::new()),
            policy,
            forward,
        }
    }
}
