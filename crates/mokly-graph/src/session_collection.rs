//! Stream validation inputs to an ordered consumer without a second composition.

use crate::collection::ComparisonCollector;
use crate::error::{Result, invalid};
use crate::references;
use crate::session::Session;
use crate::types::{ComparisonDocument, RenderGeneration, RenderSummary};
use crate::validation_summary::Summary;
use crate::workers::{ComparisonWorker, ValidatedView};

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
            for (route, input) in batch.iter().zip(inputs) {
                match input {
                    Ok(input) => {
                        summary.record(view(route, &input));
                        collector.summary(&summary.value);
                        if failure.is_none() {
                            failure = self
                                .check_cancelled()
                                .and_then(|()| collector.collect(route, input))
                                .err();
                        }
                    }
                    Err(error) => summary.record(Err(error)),
                }
            }
        }
        let summary = summary.finish(self)?;
        collector.summary(&summary);
        if let Some(failure) = failure {
            return Err(failure);
        }
        self.state
            .public_files
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .extend(summary.closure.iter().cloned());
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
        warnings: document.warnings.clone(),
    })
}
