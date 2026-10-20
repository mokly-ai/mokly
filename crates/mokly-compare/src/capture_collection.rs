//! Bounded encoded candidates retain route priority while validation facts grow.

use std::collections::BTreeMap;
use std::mem;

use mokly_graph::collection::ComparisonCollector;
use mokly_graph::error::Result;
use mokly_graph::types::{ComparisonDocument, RenderSummary};

use crate::capture_codec::EncodedView;
use crate::capture_error;
use crate::capture_weight;
use crate::comparison_capture::{CapturedGeneration, CapturedView};

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
            self.retained -= charge(&route, &view);
        }
    }
}

impl ComparisonCollector for Collector {
    fn summary(&mut self, summary: &RenderSummary) {
        self.fixed = mem::size_of::<CapturedGeneration>() + capture_weight::summary(summary);
        self.trim(self.bound.saturating_sub(self.fixed));
    }

    fn collect(&mut self, route: &str, input: ComparisonDocument) -> Result<()> {
        let document = capture_error::graph(EncodedView::encode(&input.artifact))?;
        let view = CapturedView {
            document,
            closure: input.closure,
        };
        let cost = charge(route, &view);
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

fn charge(route: &str, view: &CapturedView) -> usize {
    256 + route.len() + view.document.retained_bytes() + capture_weight::closure(&view.closure)
}

#[cfg(test)]
#[path = "_tests_/capture_collection_tests.rs"]
mod capture_collection_tests;
