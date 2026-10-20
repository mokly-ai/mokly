//! Ordered consumers release transient inputs while validation retains only facts.

use std::fmt;

use crate::error::Result;
use crate::types::{ComparisonDocument, RenderSummary};

/// A bounded consumer of documents from complete generation validation.
/// Inputs remain provisional until validation returns success.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ComparisonCollectorMock))]
pub trait ComparisonCollector {
    /// Account for growing validation facts before accepting more encoded inputs.
    fn summary(&mut self, _summary: &RenderSummary) {}
    /// Consume one validated input in route order, before the next batch starts.
    fn collect(&mut self, route: &str, input: ComparisonDocument) -> Result<()>;
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
#[path = "_tests_/collection_cancellation_tests.rs"]
mod collection_cancellation_tests;

#[cfg(test)]
#[path = "_tests_/collection_support.rs"]
mod collection_support;
