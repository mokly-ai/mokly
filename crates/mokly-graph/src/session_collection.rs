//! Stream validation inputs to an ordered consumer without a second composition.

use crate::collection::ComparisonCollector;
use crate::error::{Result, invalid};
use crate::references;
use crate::session::Session;
use crate::types::{ComparisonDocument, RenderGeneration, RenderSummary};
use crate::validation_summary::Summary;
use crate::workers::{ComparisonWorker, ValidatedView};

/// Read one view's input after a cancellation check. The check runs before the cache
/// lookup, so a cancelled capture also stops on a cache hit.
struct Inputs<'a> {
    session: &'a Session,
}

impl ComparisonWorker for Inputs<'_> {
    fn input(&self, route: &str) -> Result<ComparisonDocument> {
        self.session.check_cancelled()?;
        self.session.validation_input(route, true)
    }
}

impl Session {
    /// Validate every view in bounded route batches and pass each input to the collector
    /// in route order. Cancellation is checked before each view read and before each
    /// encode, so a cancelled capture stops with the generation's cancellation error.
    pub(crate) fn collect_validated(
        &self,
        collector: &mut dyn ComparisonCollector,
    ) -> Result<RenderSummary> {
        let mut summary = Summary::new(self);
        collector.summary(&summary.value);
        let mut failure = None;
        let mut routes = self.state.plans.keys();
        loop {
            let batch: Vec<_> = routes
                .by_ref()
                .take(self.comparison_parallelism().max(1))
                .cloned()
                .collect();
            if batch.is_empty() {
                break;
            }
            let inputs = self.schedule_comparison(&batch, &Inputs { session: self });
            let mut ready = Vec::with_capacity(batch.len());
            for (route, input) in batch.iter().zip(inputs) {
                match input {
                    Ok(input) => {
                        summary.record(view(route, &input));
                        ready.push((route, input));
                    }
                    Err(error) => summary.record(Err(error)),
                }
            }
            collector.summary(&summary.value);
            for (route, input) in ready {
                if failure.is_none() {
                    failure = self
                        .check_cancelled()
                        .and_then(|()| collector.collect(route, input))
                        .err();
                }
            }
        }
        let (summary, views) = summary.finish(self)?;
        collector.summary(&summary);
        if let Some(failure) = failure {
            return Err(failure);
        }
        for (route, view) in views {
            let key = &self.state.plans[&route].key.0;
            for path in view.closure {
                self.state.inputs.closures.record(key, &path);
            }
        }
        Ok(summary)
    }
}

pub(crate) fn view(route: &str, input: &ComparisonDocument) -> Result<ValidatedView> {
    let document = input
        .artifact
        .document
        .as_ref()
        .ok_or_else(|| invalid(route, "document has no composed tree"))?;
    Ok(ValidatedView {
        route: route.into(),
        anchors: references::anchors(&document.tree),
        links: document.links.clone(),
        closure: input.closure.files.clone(),
        warnings: document
            .warnings
            .iter()
            .chain(&input.closure.warnings)
            .cloned()
            .collect(),
    })
}
