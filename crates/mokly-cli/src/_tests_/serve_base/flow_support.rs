//! Classification helpers exercise the public Changes and production provider APIs.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_compare::base_render::{
    BaseProvider, BaseSourceFactory, BaseSourceFactoryMock, Changes, ChangesService,
    HistoricalSources,
};
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::comparison_steps::StepsMock;
use mokly_compare::comparison_types::{
    Comparison, ComparisonMock, ComparisonRequest, ComparisonResult,
};
use mokly_compare::error::Result;
use mokly_compare::source_failures::{SourceFailures, SourceFailuresMock};
use mokly_graph::types::RenderGeneration;
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use unimock::{MockFn, Unimock, matching};

#[derive(Default)]
/// Operations that a retained-base hit must avoid.
pub(super) struct Calls {
    /// Historical source factories called.
    pub(super) sources: AtomicUsize,
    /// Base provider preparations called.
    pub(super) prepares: AtomicUsize,
    /// Full base captures called.
    pub(super) captures: AtomicUsize,
}

impl Calls {
    /// Read exact counts without depending on elapsed time.
    pub(super) fn counts(&self) -> (usize, usize, usize) {
        (
            self.sources.load(Ordering::Relaxed),
            self.prepares.load(Ordering::Relaxed),
            self.captures.load(Ordering::Relaxed),
        )
    }
}

/// A source failure record inspected by classification and keep.
pub(super) fn failures() -> Arc<dyn SourceFailures> {
    Arc::new(Unimock::new(
        SourceFailuresMock::failure
            .each_call(matching!())
            .answers(&|_| None),
    ))
}

/// Count preparations whose provider does not read historical source bytes.
pub(super) fn sources(calls: Arc<Calls>) -> Arc<dyn BaseSourceFactory> {
    Arc::new(Unimock::new(
        BaseSourceFactoryMock::create
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _, _, _| {
                calls.sources.fetch_add(1, Ordering::Relaxed);
                Ok(HistoricalSources {
                    failures: failures(),
                    tree: Arc::new(Unimock::new(())),
                    sources: Arc::new(Unimock::new(())),
                })
            })),
    ))
}

/// Count captures and expose the production reader from each comparison.
pub(super) fn comparison(calls: Arc<Calls>) -> Arc<dyn Comparison> {
    Arc::new(Unimock::new((
        ComparisonMock::capture_base
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, base| {
                calls.captures.fetch_add(1, Ordering::Relaxed);
                Ok(base)
            })),
        ComparisonMock::compare_prepared
            .each_call(matching!(_))
            .answers(&|_, request, before, after| Ok(result(request, before, after))),
    )))
}

/// Enter the real Changes pipeline with an already pinned selection.
pub(super) fn classify(
    provider: Arc<dyn BaseProvider>,
    selected: PinnedBase,
    sources: Arc<dyn BaseSourceFactory>,
    comparison: Arc<dyn Comparison>,
    head: Arc<dyn RenderGeneration>,
    config: &ResolvedConfig,
) -> Result<ComparisonResult> {
    let changes: &dyn ChangesService = &Changes {
        lookup: Arc::new(Unimock::new(())),
        pinned: Some(Arc::new(selected)),
        sources,
        provider,
        comparison,
        steps: Arc::new(Unimock::new(
            StepsMock::step.each_call(matching!(_)).returns(()),
        )),
    };
    changes.classify(config, None, head, None, &mut Vec::new())
}

/// Retain public reader handles in an otherwise empty classification result.
pub(super) fn result(
    request: &ComparisonRequest,
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        warnings: Vec::new(),
        review: ReviewResultV8 {
            schema_version: 8,
            base_commit: request.base_commit.clone(),
            entries: Vec::new(),
            affected: Vec::new(),
            diagnostics: Vec::new(),
        },
        snapshot: CatalogueChangeSnapshotV4 {
            schema_version: 4,
            base_ref: request.base_ref.clone(),
            base_commit: request.base_commit.clone(),
            changed_entries: Vec::new(),
            moved_entries: Vec::new(),
            removed_entries: Vec::new(),
        },
        entries: Vec::new(),
        pairing: Default::default(),
        counts: Default::default(),
        before,
        after,
    }
}
