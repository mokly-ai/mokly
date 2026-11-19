//! Capture workers preserve frozen document and resource checks before encoding.

use std::sync::Arc;

use mokly_graph::collection::ComparisonCollector;
use mokly_graph::collection_input::{ComparisonEncoder, EncodedComparisonDocument};
use mokly_graph::document_codec::EncodedView;
use mokly_graph::error::Result;
use mokly_graph::types::{ComparisonDocument, RenderGeneration, RenderSummary};
use mokly_model::material::digest;
use mokly_model::namespace::generated;

use crate::comparison_graph::FrozenResources;

pub(crate) struct CheckedCollector<'a> {
    pub(crate) resources: &'a FrozenResources,
    pub(crate) inner: &'a mut dyn ComparisonCollector,
}

impl ComparisonCollector for CheckedCollector<'_> {
    fn encoder(&self) -> Arc<dyn ComparisonEncoder> {
        Arc::new(CheckedEncoder {
            resources: self.resources.clone(),
            inner: self.inner.encoder(),
        })
    }
    fn remaining(&self) -> usize {
        self.inner.remaining()
    }
    fn summary(&mut self, summary: &RenderSummary) {
        self.inner.summary(summary);
    }
    fn collect(&mut self, route: &str, input: EncodedComparisonDocument) -> Result<()> {
        self.inner.collect(route, input)
    }
}

struct CheckedEncoder {
    resources: FrozenResources,
    inner: Arc<dyn ComparisonEncoder>,
}

impl ComparisonEncoder for CheckedEncoder {
    fn encode(&self, route: &str, input: &ComparisonDocument) -> Result<EncodedView> {
        self.resources
            .check(&generated(route), Some(digest(&input.artifact.bytes)))?;
        for resource in input.closure.edges.keys() {
            self.resources.resource_digest(resource)?;
        }
        self.inner.encode(route, input)
    }
}
