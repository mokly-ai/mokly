//! One cancellable usage pass for each installed generation, in bounded batches.

use std::sync::Arc;

use async_trait::async_trait;
use mokly_catalogue::diagnostic::Warning;
use tokio::sync::{broadcast, watch};

use crate::backend::Documents;
use crate::background_batch::{Event, Window};
use crate::background_capacity::BackgroundCapacity;
use crate::background_stage::Stages;
use crate::changes_background::AfterUsage;
use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, Result, ServerError};
use crate::publication::{PublicationEvent, Publications};
use crate::snapshot::Snapshot;
use crate::work::Work;

/// Background lifecycle owned by the Serve composition root.
#[async_trait]
pub trait Background: Send + Sync {
    /// Run once per generation, restart on replacement, and stop admission on shutdown.
    async fn run(&self, stop: watch::Receiver<bool>);
}

/// Evidence uses the same scheduler and document adapter as foreground requests.
pub struct UsagePass {
    /// Current bound, read again before each background render starts.
    pub capacity: Arc<dyn BackgroundCapacity>,
    /// Optional Changes continuation after every current document settles.
    pub changes: Option<Arc<dyn AfterUsage>>,
    /// Atomic states and completion publisher.
    pub publications: Arc<dyn Publications>,
    /// Foreground-priority worker boundary.
    pub work: Arc<dyn Work>,
    /// Typed render failures reach the selected CLI reporter.
    pub diagnostics: Arc<dyn Diagnostics>,
}

#[async_trait]
impl Background for UsagePass {
    async fn run(&self, mut stop: watch::Receiver<bool>) {
        if stopped(&stop) {
            return;
        }
        let mut updates = self.publications.subscribe().updates;
        let stages = Stages::new(self.capacity.clone());
        loop {
            if stopped(&stop) {
                return;
            }
            let origin = self.publications.current();
            if !self
                .fill_window(&origin, &mut stop, &mut updates, &stages)
                .await
            {
                continue;
            }
            if let Some(changes) = &self.changes {
                changes.run(origin.clone(), stop.clone()).await;
            }
            while Arc::ptr_eq(&self.publications.current().documents, &origin.documents) {
                if stopped(&stop) {
                    return;
                }
                tokio::select! {
                    _ = stop.changed() => return,
                    _ = updates.recv() => {},
                }
            }
        }
    }
}

impl UsagePass {
    #[tracing::instrument(name = "serve.background", skip_all, fields(status = "ok"))]
    async fn fill_window(
        &self,
        origin: &Arc<Snapshot>,
        stop: &mut watch::Receiver<bool>,
        updates: &mut broadcast::Receiver<PublicationEvent>,
        stages: &Arc<Stages>,
    ) -> bool {
        let mut window = Window::new(1);
        let mut routes = origin.routes.iter().enumerate();
        loop {
            loop {
                tokio::task::yield_now().await;
                window.set_limit(self.capacity.capacity());
                if !window.has_room() {
                    break;
                }
                let Some((position, route)) = routes.next() else {
                    break;
                };
                let current = self.publications.current();
                if stopped(stop) || !Arc::ptr_eq(&current.documents, &origin.documents) {
                    return cancelled();
                }
                if current.completed.contains_key(&route.route) {
                    continue;
                }
                if origin.documents.can_prepare_root(&route.route) {
                    let stage = stages.view(&route.route);
                    window.start_staged(
                        position,
                        self.work.background_staged(
                            origin.documents.clone(),
                            route.route.clone(),
                            stage.clone(),
                        ),
                        stage,
                    );
                } else {
                    window.start(
                        position,
                        self.work
                            .background(origin.documents.clone(), route.route.clone()),
                    );
                }
            }
            if window.is_empty() {
                break;
            }
            tokio::select! {
                _ = stop.changed() => return cancelled(),
                _ = updates.recv() => {
                    if !Arc::ptr_eq(&self.publications.current().documents, &origin.documents) { return cancelled(); }
                },
                event = window.next_event() => {
                    if stopped(stop) || !Arc::ptr_eq(&self.publications.current().documents, &origin.documents) { return cancelled(); }
                    if let Event::Completed(position, result) = event {
                        for outcome in window.settle(position, result) { self.report(origin.documents.as_ref(), outcome); }
                    }
                }
            }
        }
        let publications = self.publications.clone();
        let publish_origin = origin.clone();
        let routes: Vec<_> = origin
            .routes
            .iter()
            .map(|route| route.route.clone())
            .collect();
        let parent = tracing::Span::current();
        let result = tokio::task::spawn_blocking(move || {
            parent.in_scope(|| publications.completed_many(&publish_origin, &routes))
        })
        .await;
        if stopped(stop) || !Arc::ptr_eq(&self.publications.current().documents, &origin.documents)
        {
            return cancelled();
        }
        match result {
            Ok(Ok(())) => {}
            Ok(Err(error)) => self.diagnostics.failed(&error),
            Err(source) => self
                .diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source })),
        }
        true
    }
    #[cfg(test)]
    async fn fill(
        &self,
        origin: &Arc<Snapshot>,
        stop: &mut watch::Receiver<bool>,
        updates: &mut broadcast::Receiver<PublicationEvent>,
    ) -> bool {
        self.fill_window(origin, stop, updates, &Stages::new(self.capacity.clone()))
            .await
    }

    /// Report one view as a serial pass did: its warnings, then its failure diagnostic.
    fn report(&self, documents: &dyn Documents, outcome: Result<Vec<Warning>>) {
        match outcome {
            Ok(warnings) => documents.report(&warnings, false),
            Err(error) => {
                if let ServerError::Render { source } = &error {
                    documents.report(&source.warnings(), true);
                }
                self.diagnostics.failed(&error);
            }
        }
    }
}

fn cancelled() -> bool {
    tracing::Span::current().record("status", "error");
    false
}
#[cfg(test)]
#[path = "_tests_/background_tests.rs"]
mod background_tests;

/// A closed stop channel has the same ownership meaning as an explicit stop.
pub(crate) fn stopped(stop: &watch::Receiver<bool>) -> bool {
    *stop.borrow() || stop.has_changed().is_err()
}

#[cfg(test)]
#[path = "_tests_/quiet_background_tests.rs"]
mod quiet_background_tests;

#[cfg(test)]
#[path = "_tests_/background_batch/mod.rs"]
mod background_batch_tests;

#[cfg(test)]
#[path = "_tests_/overlap/mod.rs"]
mod overlap_tests;
