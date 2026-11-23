//! Fake validated producer records facts and hands off encoded inputs in route order.

use mokly_catalogue::diagnostic::normalize_warnings;
use mokly_graph::collection::ComparisonCollector;
use mokly_graph::collection_input::EncodedComparisonDocument;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::types::ComparisonDocument;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock, RenderSummary};
use unimock::{Clause, MockFn, matching};

pub(crate) fn collection() -> impl Clause {
    RenderGenerationMock::collect_comparison
        .each_call(matching!(_))
        .answers(&|source, collector| produce(source, collector))
}

fn produce(
    source: &dyn RenderGeneration,
    collector: &mut dyn ComparisonCollector,
) -> Result<RenderSummary> {
    let routes: Vec<_> = source.plans().keys().cloned().collect();
    let mut summary = RenderSummary {
        documents: routes.len(),
        ..Default::default()
    };
    collector.summary(&summary);
    let mut failures = Vec::new();
    let mut collection_failure = None;
    for route in &routes {
        match source.comparison_input(route) {
            Ok(input) => {
                summary.closure.extend(input.closure.files.iter().cloned());
                if let Some(document) = &input.artifact.document {
                    summary.warnings.extend(document.warnings.iter().cloned());
                }
                collector.summary(&summary);
                if collection_failure.is_none() {
                    collection_failure = source
                        .check_cancelled()
                        .and_then(|()| collect(collector, route, input))
                        .err();
                }
            }
            Err(error) => failures.push(error),
        }
    }
    if !failures.is_empty() {
        return Err(GraphError::Attempt {
            failures,
            warnings: summary.warnings,
        });
    }
    normalize_warnings(&mut summary.warnings);
    collector.summary(&summary);
    if let Some(error) = collection_failure {
        return Err(error);
    }
    Ok(summary)
}

pub(crate) fn collect(
    collector: &mut dyn ComparisonCollector,
    route: &str,
    input: ComparisonDocument,
) -> Result<()> {
    let encoded = EncodedComparisonDocument::encode(route, input, collector.encoder().as_ref())?;
    collector.collect(route, encoded)
}
