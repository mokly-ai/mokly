//! Mock generations and typed comparison data for kept-base tests.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use unimock::{MockFn, Unimock, matching};

use crate::base_retention::KeptBase;
use crate::comparison_types::{Comparison, ComparisonRequest, ComparisonResult};
use crate::error::{Error, Result};
use crate::source_failures::{SourceFailures, SourceFailuresMock};

use super::harness::State;

/// Record optional preparation calls while the comparison mock checks required calls.
pub(super) struct RecordedComparison {
    /// Mock for base capture and comparison.
    pub(super) inner: Unimock,
    /// Call record shared with the classification test.
    pub(super) state: Arc<Mutex<State>>,
}

impl Comparison for RecordedComparison {
    fn prepare_head(&self, request: &ComparisonRequest, head: &Arc<dyn RenderGeneration>) {
        self.state
            .lock()
            .unwrap()
            .head_preparations
            .push((request.clone(), Arc::downgrade(head)));
    }

    fn capture_base(&self, before: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
        self.inner.capture_base(before)
    }

    fn compare_prepared(
        &self,
        request: &ComparisonRequest,
        before: Arc<dyn RenderGeneration>,
        after: Arc<dyn RenderGeneration>,
    ) -> Result<ComparisonResult> {
        self.inner.compare_prepared(request, before, after)
    }
}

pub(super) fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        roots: Vec::new(),
        modules: Default::default(),
        authored_inputs: Vec::new(),
    }
}

pub(super) fn warning() -> Warning {
    Warning {
        code: "base-dependencies",
        subject: WarningSubject::Configuration("mokly.config.json".into()),
        message: "base dependency diagnostic".into(),
    }
}

pub(super) fn failures(failure: Arc<Mutex<Option<Arc<Error>>>>) -> Arc<dyn SourceFailures> {
    Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| failure.lock().unwrap().clone())),
    ))
}

pub(super) fn generation(fail: bool, reads: Arc<AtomicUsize>) -> Arc<dyn RenderGeneration> {
    Arc::new(Unimock::new((
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        RenderGenerationMock::resource_digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                reads.fetch_add(1, Ordering::AcqRel);
                if fail {
                    Err(provider_error())
                } else {
                    Ok(Some("digest".into()))
                }
            })),
    )))
}

pub(super) fn kept(
    generation: Arc<dyn RenderGeneration>,
    failure: Arc<Mutex<Option<Arc<Error>>>>,
) -> Arc<KeptBase> {
    Arc::new(KeptBase {
        generation,
        failures: failures(failure),
        scripts_off: true,
        freshness: None,
    })
}

pub(super) fn provider_error() -> GraphError {
    GraphError::Internal(InternalError::Provider {
        source: Box::new(Error::UnsupportedManager),
    })
}

pub(super) fn result(
    request: &ComparisonRequest,
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        warnings: vec![warning()],
        review: ReviewResultV8 {
            schema_version: 8,
            base_commit: request.base_commit.clone(),
            entries: vec![],
            affected: vec![],
            diagnostics: vec![],
        },
        snapshot: CatalogueChangeSnapshotV4 {
            schema_version: 4,
            base_ref: request.base_ref.clone(),
            base_commit: request.base_commit.clone(),
            changed_entries: vec![],
            moved_entries: vec![],
            removed_entries: vec![],
        },
        entries: vec![],
        pairing: Default::default(),
        counts: Default::default(),
        before,
        after,
    }
}
