//! One cancellable usage pass for each installed generation, in bounded batches.

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::{broadcast, watch};

use crate::background_batch::Window;
use crate::changes_background::AfterUsage;
use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, ServerError};
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
    /// At most this many background renders run at once; zero runs one.
    pub batch: usize,
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
        loop {
            if stopped(&stop) {
                return;
            }
            let origin = self.publications.current();
            if !self.fill(&origin, &mut stop, &mut updates).await {
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
    async fn fill(
        &self,
        origin: &Arc<Snapshot>,
        stop: &mut watch::Receiver<bool>,
        updates: &mut broadcast::Receiver<PublicationEvent>,
    ) -> bool {
        let mut window = Window::new(self.batch);
        let mut routes = origin.routes.iter().enumerate();
        loop {
            while window.has_room()
                && let Some((position, route)) = routes.next()
            {
                tokio::task::yield_now().await;
                let current = self.publications.current();
                if stopped(stop) || !Arc::ptr_eq(&current.documents, &origin.documents) {
                    return cancelled();
                }
                if current.completed.contains_key(&route.route) {
                    continue;
                }
                window.start(
                    position,
                    self.work
                        .background(origin.documents.clone(), route.route.clone()),
                );
            }
            if window.is_empty() {
                break;
            }
            tokio::select! {
                _ = stop.changed() => return cancelled(),
                _ = updates.recv() => {
                    if !Arc::ptr_eq(&self.publications.current().documents, &origin.documents) { return cancelled(); }
                },
                (position, result) = window.next() => {
                    if stopped(stop) || !Arc::ptr_eq(&self.publications.current().documents, &origin.documents) { return cancelled(); }
                    for error in window.settle(position, result) { self.diagnostics.failed(&error); }
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
