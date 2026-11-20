//! Bounded encoded candidates retain route priority while validation facts grow.

use std::collections::BTreeMap;
use std::mem;
use std::sync::Arc;

use mokly_graph::collection::ComparisonCollector;
use mokly_graph::collection_input::{ComparisonEncoder, EncodedComparisonDocument};
use mokly_graph::comparison_proof::ContentIdentity;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::error::Result;
use mokly_graph::types::{ComparisonDocument, RenderSummary};

use crate::capture_error::{self, CaptureResult};
use crate::capture_generation::CapturedGeneration;
use crate::capture_weight;
use crate::comparison_capture::CapturedView;

pub(crate) struct Collector {
    bound: usize,
    fixed: usize,
    retained: usize,
    pub(crate) views: BTreeMap<String, CapturedView>,
}

impl Collector {
    pub(crate) fn new(bound: usize) -> Self {
        Self {
            bound,
            fixed: mem::size_of::<CapturedGeneration>(),
            retained: 0,
            views: BTreeMap::new(),
        }
    }

    pub(crate) fn trim(&mut self, capacity: usize) {
        while self.retained > capacity {
            let Some((route, view)) = self.views.pop_last() else {
                break;
            };
            self.retained -= view.charge(&route);
        }
    }
}

impl ComparisonCollector for Collector {
    fn encoder(&self) -> Arc<dyn ComparisonEncoder> {
        Arc::new(Encoder)
    }

    fn remaining(&self) -> usize {
        self.bound
            .saturating_sub(self.fixed)
            .saturating_sub(self.retained)
    }
    fn summary(&mut self, summary: &RenderSummary) {
        self.fixed = mem::size_of::<CapturedGeneration>() + capture_weight::summary(summary);
        self.trim(self.bound.saturating_sub(self.fixed));
    }

    fn collect(&mut self, route: &str, input: EncodedComparisonDocument) -> Result<()> {
        let view = CapturedView {
            document: input.document,
            identity: input.identity,
            closure: input.closure,
        };
        let cost = view.charge(route);
        if cost
            <= self
                .bound
                .saturating_sub(self.fixed)
                .saturating_sub(self.retained)
        {
            self.retained += cost;
            self.views.insert(route.to_owned(), view);
        }
        Ok(())
    }
}

struct Encoder;

impl ComparisonEncoder for Encoder {
    #[tracing::instrument(name = "review.capture-encode", skip_all, fields(status = "error"))]
    fn encode(
        &self,
        _route: &str,
        input: &ComparisonDocument,
    ) -> Result<(EncodedView, ContentIdentity)> {
        let encoded =
            capture_error::graph(EncodedView::encode_identified(&input.artifact).capture())?;
        tracing::Span::current().record("status", "ok");
        Ok(encoded)
    }
}

#[cfg(test)]
#[path = "_tests_/capture_collection_tests.rs"]
mod capture_collection_tests;

#[cfg(test)]
#[path = "_tests_/capture_window_retention_tests.rs"]
mod capture_window_retention_tests;
