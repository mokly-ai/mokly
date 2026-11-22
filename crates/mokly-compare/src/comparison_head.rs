//! Head validation and the evidence that makes its result reusable before pairing.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Weak};

use mokly_graph::types::RenderGeneration;

use crate::comparison_error::CompareResult;
use crate::comparison_types::ComparisonRequest;
use crate::error::Result;
use crate::reuse_budget::Resident;
use crate::reuse_collection::{Classification, Collection};
use crate::validation_head::Head;

/// The current reuse settings and the accepted comparison at one instant.
pub(super) struct HeadInputs {
    /// Fence of this request and the adopted configuration and settings.
    pub(super) fence: Option<[u8; 32]>,
    /// Accepted classification, including one that cannot supply view evidence.
    pub(super) accepted: Option<Arc<Classification>>,
}

impl HeadInputs {
    /// Collect the validated head inputs and retain the validation outcome.
    pub(super) fn validate(
        self,
        resident: Arc<Resident>,
        after: &Arc<dyn RenderGeneration>,
    ) -> (Collection, Result<()>) {
        let accepted_bytes = self.accepted.as_ref().map_or(0, |accepted| accepted.bytes);
        let previous = self
            .accepted
            .filter(|previous| Some(previous.fence) == self.fence);
        let mut collection = Collection::new(resident, previous, self.fence);
        collection.work.accepted_bytes = accepted_bytes;
        let validation = validate(after, &mut collection);
        (collection, validation)
    }
}

/// Single-use head validation held while the base prepares.
pub(super) struct PreparedHead {
    request: ComparisonRequest,
    fence: Option<[u8; 32]>,
    accepted: Option<Weak<Classification>>,
    after: Arc<dyn RenderGeneration>,
    collection: Collection,
    validation: Result<()>,
}

impl PreparedHead {
    /// Validate the head with the reuse inputs available at preparation time.
    pub(super) fn new(
        request: &ComparisonRequest,
        after: &Arc<dyn RenderGeneration>,
        inputs: HeadInputs,
        resident: Arc<Resident>,
    ) -> Self {
        let fence = inputs.fence;
        let accepted = inputs.accepted.as_ref().map(Arc::downgrade);
        let (collection, validation) = inputs.validate(resident, after);
        Self {
            request: request.clone(),
            fence,
            accepted,
            after: after.clone(),
            collection,
            validation,
        }
    }

    /// Check the request and both identities before adopting the prepared collection.
    pub(super) fn matches(
        &self,
        request: &ComparisonRequest,
        after: &Arc<dyn RenderGeneration>,
        inputs: &HeadInputs,
    ) -> bool {
        self.fence == inputs.fence
            && self.request == *request
            && Arc::ptr_eq(&self.after, after)
            && match (&self.accepted, &inputs.accepted) {
                (Some(prepared), Some(current)) => prepared
                    .upgrade()
                    .is_some_and(|prepared| Arc::ptr_eq(&prepared, current)),
                (None, None) => true,
                _ => false,
            }
    }

    /// Take the same collection and outcome as serial validation produces.
    pub(super) fn into_parts(self) -> (Collection, Result<()>) {
        (self.collection, self.validation)
    }
}

fn validate(after: &Arc<dyn RenderGeneration>, reuse: &mut Collection) -> Result<()> {
    let previous = reuse.previous.as_deref().and_then(Classification::fact_id);
    let current = reuse.candidate.as_ref().and_then(Classification::fact_id);
    let head = Head::new(
        after.clone(),
        reuse.resident.clone(),
        previous,
        current,
        reuse.previous.is_some(),
    );
    let validated = after.validate_head(&head).compare();
    reuse.work.validation_documents = head.documents.load(Ordering::Relaxed);
    reuse.work.validation_reused = head.reused.load(Ordering::Relaxed);
    reuse.work.validation_walks = head.walks.load(Ordering::Relaxed);
    validated?;
    reuse.resident.with_optional([current, None], |arenas| {
        if let Some(arena) = arenas[0] {
            arena.finish_inputs();
        }
    });
    *reuse
        .probes
        .documents
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = head
        .proofs
        .into_inner()
        .unwrap_or_else(|error| error.into_inner());
    Ok(())
}
