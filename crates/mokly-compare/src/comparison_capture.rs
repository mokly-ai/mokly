//! Bounded side inputs replay exact documents while uncaptured inputs use their source.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::error::Result;
use mokly_graph::types::RenderGeneration;

use crate::capture_collection::Collector;
use crate::capture_error::{self, CaptureResult};
use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::LosslessRestorer;
use crate::capture_styles::{self, EncodedResource};
use crate::capture_weight::{self, Budget, DEFAULT_BASE_CAPTURE_BYTES, DEFAULT_HEAD_CAPTURE_BYTES};

/// Which render-generation side a capture belongs to.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CaptureSide {
    /// The pinned Git base generation.
    Base,
    /// The working-tree head generation.
    Head,
}

impl CaptureSide {
    fn label(self) -> &'static str {
        match self {
            Self::Base => "base",
            Self::Head => "head",
        }
    }

    fn bound(self) -> usize {
        match self {
            Self::Base => DEFAULT_BASE_CAPTURE_BYTES,
            Self::Head => DEFAULT_HEAD_CAPTURE_BYTES,
        }
    }
}

pub(crate) struct CapturedView {
    pub(crate) document: EncodedView,
    pub(crate) identity: ContentIdentity,
    pub(crate) closure: Closure,
}

impl CapturedView {
    #[tracing::instrument(name = "review.capture-encode", skip_all, fields(status = "error"))]
    pub(crate) fn encode(artifact: &Artifact, closure: Closure) -> Result<Self> {
        let (document, identity) =
            capture_error::graph(EncodedView::encode_identified(artifact).capture())?;
        tracing::Span::current().record("status", "ok");
        Ok(Self {
            document,
            identity,
            closure,
        })
    }

    pub(crate) fn charge(&self, route: &str) -> usize {
        256 + route.len()
            + self.document.retained_bytes()
            + mem::size_of::<ContentIdentity>()
            + capture_weight::closure(&self.closure)
    }
}

/// The result owns bounded side inputs; the original source handles every cache miss.
pub(crate) fn capture(
    source: Arc<dyn RenderGeneration>,
    side: CaptureSide,
) -> Result<Arc<dyn RenderGeneration>> {
    capture_with_bound(source, side.bound(), side)
}

#[tracing::instrument(name = "review.capture-side", skip_all, fields(side = side.label(), status = "error", views = tracing::field::Empty, uncaptured_views = tracing::field::Empty, retained_bytes = tracing::field::Empty, encoded_bytes = tracing::field::Empty))]
pub(crate) fn capture_with_bound(
    source: Arc<dyn RenderGeneration>,
    bound: usize,
    side: CaptureSide,
) -> Result<Arc<dyn RenderGeneration>> {
    let source = if let Some(previous) = source.comparison_capture() {
        if previous.retained_bytes <= bound {
            complete(
                previous.views,
                previous.source.plans().len(),
                previous.retained_bytes,
                previous.encoded_bytes,
            );
            return Ok(source);
        }
        previous.source
    } else {
        source
    };
    let mut collector = Collector::new(bound);
    let summary = {
        let span = tracing::info_span!("review.capture-validate", status = "error");
        let _entered = span.enter();
        let summary = source.collect_comparison(&mut collector)?;
        span.record("status", "ok");
        summary
    };
    let mut budget = Budget::new(bound);
    if !budget.retain(mem::size_of::<CapturedGeneration>() + capture_weight::summary(&summary)) {
        complete(0, summary.documents, 0, 0);
        return Ok(source);
    }
    let styles = capture_styles::capture(source.as_ref(), &mut budget, &mut |remaining| {
        collector.trim(remaining)
    })?;
    let mut views = BTreeMap::new();
    let mut encoded_bytes = styles
        .values()
        .map(EncodedResource::encoded_bytes)
        .sum::<usize>();
    for (route, view) in collector.views {
        if budget.retain(view.charge(&route)) {
            encoded_bytes += view.document.bytes();
            views.insert(route, view);
        }
    }
    complete(
        views.len(),
        summary.documents,
        budget.retained,
        encoded_bytes,
    );
    Ok(Arc::new(CapturedGeneration {
        source,
        views,
        summary,
        styles,
        retained_bytes: budget.retained,
        encoded_bytes,
        restorer: Box::new(LosslessRestorer),
    }))
}

fn complete(views: usize, total: usize, retained: usize, encoded: usize) {
    let span = tracing::Span::current();
    span.record("views", views as u64);
    span.record("uncaptured_views", total.saturating_sub(views) as u64);
    span.record("retained_bytes", retained as u64);
    span.record("encoded_bytes", encoded as u64);
    span.record("status", "ok");
}

#[cfg(test)]
#[path = "_tests_/comparison_capture_tests.rs"]
mod comparison_capture_tests;

#[cfg(test)]
#[path = "_tests_/capture_batch_tests.rs"]
mod capture_batch_tests;

#[cfg(test)]
#[path = "_tests_/capture_cancellation_tests.rs"]
mod capture_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/capture_restore_tests.rs"]
mod capture_restore_tests;

#[cfg(test)]
#[path = "_tests_/capture_usage/mod.rs"]
mod capture_usage;

#[cfg(test)]
#[path = "_tests_/capture_usage_tests.rs"]
mod capture_usage_tests;
