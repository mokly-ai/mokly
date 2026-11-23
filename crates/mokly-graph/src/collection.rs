//! Ordered consumers release transient inputs while validation retains only facts.

use std::fmt;
use std::sync::Arc;

use crate::collection_input::{ComparisonEncoder, DocumentEncoder, EncodedComparisonDocument};
use crate::error::Result;
use crate::types::RenderSummary;

/// A bounded consumer of documents from complete generation validation.
/// Inputs remain provisional until validation returns success.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonCollectorMock))]
pub trait ComparisonCollector {
    /// Return the worker-side encoder without borrowing the ordered collector.
    fn encoder(&self) -> Arc<dyn ComparisonEncoder> {
        Arc::new(DocumentEncoder)
    }
    /// Unused capture bytes available to completed results waiting for route order.
    /// Unknown capacity keeps results within their occupied worker slots.
    fn remaining(&self) -> usize {
        0
    }
    /// Account for growing validation facts before accepting more encoded inputs.
    fn summary(&mut self, _summary: &RenderSummary) {}
    /// Consume one encoded input at its turn in byte route order.
    fn collect(&mut self, route: &str, input: EncodedComparisonDocument) -> Result<()>;
}

impl fmt::Debug for dyn ComparisonCollector + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ComparisonCollector")
    }
}

#[cfg(test)]
#[path = "_tests_/collection_tests.rs"]
mod collection_tests;

#[cfg(test)]
#[path = "_tests_/collection_order_tests.rs"]
mod collection_order_tests;

#[cfg(test)]
#[path = "_tests_/collection_cancellation_tests.rs"]
mod collection_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/collection_support.rs"]
mod collection_support;

#[cfg(test)]
#[path = "_tests_/prefetch_tests.rs"]
mod prefetch_tests;

#[cfg(test)]
#[path = "_tests_/prefetch_eviction_tests.rs"]
mod prefetch_eviction_tests;

#[cfg(test)]
#[path = "_tests_/persistent_session_tests.rs"]
mod persistent_session_tests;

#[cfg(test)]
#[path = "_tests_/persistent_resource_tests.rs"]
mod persistent_resource_tests;

#[cfg(test)]
#[path = "_tests_/persistent_identity_tests.rs"]
mod persistent_identity_tests;

#[cfg(test)]
#[path = "_tests_/prefetch_persistence_tests.rs"]
mod prefetch_persistence_tests;
