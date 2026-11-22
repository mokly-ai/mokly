//! Serve-owned admission of one bounded, complete comparison classification.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use mokly_graph::types::RenderGeneration;
use serde::Serialize;

use crate::comparison::Engine;
use crate::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use crate::error::Result;
use crate::reuse_budget::Resident;
use crate::reuse_collection::{Classification, Collection};
use crate::reuse_digest;

/// Content identity of adopted Serve configuration and settings.
#[derive(Clone, Copy)]
pub struct ReuseFence([u8; 32]);

impl ReuseFence {
    /// Hash structured settings without retaining their serialized bytes.
    pub fn new(settings: &impl Serialize) -> Option<Self> {
        reuse_digest::digest(settings).map(Self)
    }
}

/// Private runtime diagnostics, never a publication wire type.
#[derive(Clone, Copy, Debug, Default)]
pub struct ReuseWork {
    /// Candidate comparison payload charge, excluding optional validation facts.
    pub comparison_kept_bytes: usize,
    /// Current optional closure fact charge, inside the comparison bound.
    pub validation_fact_bytes: usize,
    /// Lifetime peak optional closure fact charge, inside the comparison bound.
    pub validation_fact_peak_bytes: usize,
    /// Head closures proved without another walk in this attempt.
    pub validation_reused: usize,
    /// Head closures walked in this attempt.
    pub validation_walks: usize,
    /// Head documents checked during complete head validation.
    pub validation_documents: usize,
    /// Peak charged memory over the Serve lifetime.
    pub peak_bytes: usize,
    /// Candidate views collected before any overflow.
    pub candidate_views: usize,
    /// Candidate payload charge, excluding other attempts and probes.
    pub candidate_bytes: usize,
    /// Accepted payload charge at the start of this attempt.
    pub accepted_bytes: usize,
    /// Successful overflow clears all retention on admission.
    pub overflowed: bool,
    /// Views compared during the latest attempt.
    pub compared: usize,
    /// Views accepted after complete input revalidation.
    pub reused: usize,
    /// Recorded generation and resource dependencies.
    pub reads: usize,
    /// All charged resident allocations, including draining attempts.
    pub retained_bytes: usize,
}

/// One classification's staging, separate from its published result.
pub trait ReuseAttempt: Comparison {
    /// Admit staging only after successful Ready publication.
    fn accept(&self);
    /// Discard unaccepted staging after failure or cancellation.
    fn discard(&self);
    /// Read the attempt's actual work and current resident charge.
    fn work(&self) -> ReuseWork;
}

/// Shared Serve lifetime across immutable source generations.
pub trait ComparisonReuse: Send + Sync {
    /// Start isolated staging with an adopted configuration and settings fence.
    fn begin(&self, engine: Engine, fence: Option<ReuseFence>) -> Arc<dyn ReuseAttempt>;
}

/// Native bounded retention service. Its bound includes simultaneous staging.
pub struct MemoryComparisons {
    shared: Arc<Shared>,
}

struct Shared {
    resident: Arc<Resident>,
    accepted: Mutex<Option<Arc<Classification>>>,
}

impl MemoryComparisons {
    /// Construct an empty service with a fixed charged resident bound.
    pub fn new(bound: usize) -> Self {
        Self {
            shared: Arc::new(Shared {
                resident: Resident::new(bound),
                accepted: Mutex::new(None),
            }),
        }
    }
}

struct Attempt {
    engine: Engine,
    shared: Arc<Shared>,
    fence: Option<ReuseFence>,
    staged: Mutex<Option<Option<Classification>>>,
    work: Mutex<ReuseWork>,
}

impl ComparisonReuse for MemoryComparisons {
    fn begin(&self, engine: Engine, fence: Option<ReuseFence>) -> Arc<dyn ReuseAttempt> {
        Arc::new(Attempt {
            engine,
            shared: self.shared.clone(),
            fence,
            staged: Mutex::new(None),
            work: Mutex::new(ReuseWork::default()),
        })
    }
}
impl Comparison for Attempt {
    #[tracing::instrument(name = "review.compare-views", skip_all, fields(status = "error", views = tracing::field::Empty, admitted_views = 0u64, unchanged = tracing::field::Empty, changed = tracing::field::Empty, ignored_only = tracing::field::Empty, reused = tracing::field::Empty, compared = tracing::field::Empty, recorded_reads = tracing::field::Empty, retained_bytes = tracing::field::Empty, revalidation_ms = tracing::field::Empty, recording_ms = tracing::field::Empty, recording_identity_reads = tracing::field::Empty, current_usage_ms = tracing::field::Empty, identities_checked = tracing::field::Empty, identity_reads = tracing::field::Empty, peak_bytes = tracing::field::Empty, candidate_views = tracing::field::Empty, candidate_bytes = tracing::field::Empty, accepted_bytes = tracing::field::Empty, overflowed = tracing::field::Empty, validation_fact_bytes = tracing::field::Empty, validation_fact_peak_bytes = tracing::field::Empty, comparison_kept_bytes = tracing::field::Empty, validation_reused = tracing::field::Empty, validation_walks = tracing::field::Empty, validation_documents = tracing::field::Empty))]
    fn compare_prepared(
        &self,
        request: &ComparisonRequest,
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult> {
        self.discard();
        let fence = self.fence.and_then(|settings| {
            reuse_digest::digest(&(
                settings.0,
                &request.base_ref,
                &request.base_commit,
                &request.catalogue_identity,
            ))
        });
        let (previous, accepted_bytes) = {
            let accepted = self
                .shared
                .accepted
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            (
                accepted
                    .as_ref()
                    .filter(|previous| Some(previous.fence) == fence)
                    .cloned(),
                accepted.as_ref().map_or(0, |accepted| accepted.bytes),
            )
        };
        let mut collection = Collection::new(self.shared.resident.clone(), previous, fence);
        collection.work.accepted_bytes = accepted_bytes;
        let result = self
            .engine
            .compare_reusing(request, before, after, Some(&mut collection));
        collection.work.retained_bytes = self.shared.resident.bytes();
        collection.work.peak_bytes = self.shared.resident.peak();
        collection.work.validation_fact_bytes = self.shared.resident.fact_bytes();
        collection.work.validation_fact_peak_bytes = self.shared.resident.fact_peak();
        collection.work.comparison_kept_bytes = collection
            .candidate
            .as_ref()
            .map_or(0, |candidate| candidate.bytes);
        let span = tracing::Span::current();
        span.record(
            "validation_fact_bytes",
            collection.work.validation_fact_bytes as u64,
        );
        span.record(
            "validation_fact_peak_bytes",
            collection.work.validation_fact_peak_bytes as u64,
        );
        span.record(
            "comparison_kept_bytes",
            collection.work.comparison_kept_bytes as u64,
        );
        span.record(
            "validation_reused",
            collection.work.validation_reused as u64,
        );
        span.record("validation_walks", collection.work.validation_walks as u64);
        span.record(
            "validation_documents",
            collection.work.validation_documents as u64,
        );
        span.record("peak_bytes", collection.work.peak_bytes as u64);
        span.record("candidate_views", collection.work.candidate_views as u64);
        span.record("candidate_bytes", collection.work.candidate_bytes as u64);
        span.record("accepted_bytes", collection.work.accepted_bytes as u64);
        span.record("overflowed", collection.work.overflowed);
        span.record("reused", collection.work.reused as u64);
        span.record("compared", collection.work.compared as u64);
        span.record("recorded_reads", collection.work.reads as u64);
        span.record("retained_bytes", collection.work.retained_bytes as u64);
        span.record(
            "revalidation_ms",
            collection.probes.revalidation_nanos.load(Ordering::Relaxed) as f64 / 1_000_000.0,
        );
        span.record(
            "recording_ms",
            collection.probes.recording_nanos.load(Ordering::Relaxed) as f64 / 1_000_000.0,
        );
        span.record(
            "recording_identity_reads",
            collection.probes.recording_reads.load(Ordering::Relaxed) as u64,
        );
        span.record(
            "current_usage_ms",
            collection.probes.usage_nanos.load(Ordering::Relaxed) as f64 / 1_000_000.0,
        );
        span.record(
            "identities_checked",
            collection.probes.checked.load(Ordering::Relaxed) as u64,
        );
        span.record(
            "identity_reads",
            collection.probes.reads.load(Ordering::Relaxed) as u64,
        );
        *self.work.lock().unwrap_or_else(|error| error.into_inner()) = collection.work;
        if result.is_ok() {
            *self
                .staged
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = Some(collection.candidate);
        }
        result
    }
}
impl ReuseAttempt for Attempt {
    fn accept(&self) {
        let candidate = self
            .staged
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(candidate) = candidate {
            *self
                .shared
                .accepted
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = candidate.map(Arc::new);
        }
    }
    fn discard(&self) {
        *self
            .staged
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = None;
    }
    fn work(&self) -> ReuseWork {
        let mut work = *self.work.lock().unwrap_or_else(|error| error.into_inner());
        work.retained_bytes = self.shared.resident.bytes();
        work.validation_fact_bytes = self.shared.resident.fact_bytes();
        work.validation_fact_peak_bytes = self.shared.resident.fact_peak();
        work
    }
}

#[cfg(test)]
#[path = "_tests_/reuse/mod.rs"]
mod reuse_tests;
