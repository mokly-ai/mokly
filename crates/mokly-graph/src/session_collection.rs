//! Ordered validation and capture consume a completion-driven encoded window.

use crate::capture_window::CaptureConsumer;
use crate::collection::ComparisonCollector;
use crate::collection_jobs::Jobs;
use crate::error::{GraphError, Result};
use crate::references;
use crate::session::Session;
use crate::types::{ComparisonDocument, RenderGeneration, RenderSummary};
use crate::validation_summary::Summary;
use crate::workers::ValidatedView;

/// Waiting outputs use remaining capture bytes. An ordered commit can use those
/// bytes first, while its occupied worker slot carries the resulting overage.
/// Admission resumes only after the queued charge fits beside retained views.
struct Consumer<'a> {
    jobs: &'a Jobs<'a>,
    collector: &'a mut dyn ComparisonCollector,
    summary: Summary,
    next: usize,
    failure: Option<GraphError>,
}

impl CaptureConsumer for Consumer<'_> {
    fn admit(&mut self, index: usize) -> bool {
        index < self.jobs.routes.len()
    }

    fn complete(&mut self, _index: usize) -> bool {
        while let Some(completed) = self.jobs.take(self.next) {
            let route = &self.jobs.routes[self.next];
            self.summary.record(completed.view);
            self.collector.summary(&self.summary.value);
            if self.failure.is_none()
                && let Some(encoded) = completed.encoded
            {
                self.failure = self
                    .jobs
                    .session
                    .check_cancelled()
                    .and(encoded)
                    .and_then(|input| self.collector.collect(route, input))
                    .err();
            }
            self.next += 1;
        }
        self.jobs.queued_bytes() <= self.collector.remaining()
    }
}

impl Session {
    pub(crate) fn collect_validated(
        &self,
        collector: &mut dyn ComparisonCollector,
    ) -> Result<RenderSummary> {
        let summary = Summary::new(self);
        collector.summary(&summary.value);
        let jobs = Jobs {
            session: self,
            routes: self.state.plans.keys().cloned().collect(),
            encoder: collector.encoder(),
            outputs: Default::default(),
        };
        let mut consumer = Consumer {
            jobs: &jobs,
            collector,
            summary,
            next: 0,
            failure: None,
        };
        self.schedule_capture_window(&jobs, &mut consumer);
        let (summary, views) = consumer.summary.finish(self)?;
        consumer.collector.summary(&summary);
        if let Some(failure) = consumer.failure {
            return Err(failure);
        }
        for (route, view) in views {
            let key = &self.state.plans[&route].key.0;
            for path in view.closure {
                self.state.inputs.closures.record(key, &path);
            }
            self.offer_document(&route);
        }
        Ok(summary)
    }
}

pub(crate) fn view(route: &str, input: &ComparisonDocument) -> ValidatedView {
    let document = input
        .artifact
        .document
        .as_ref()
        .expect("comparison document artifacts carry their composed tree");
    ValidatedView {
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
    }
}
