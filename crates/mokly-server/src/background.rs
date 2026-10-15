//! One cancellable catalogue-order usage pass for each installed generation.

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::{broadcast, watch};

use crate::diagnostics::Diagnostics;
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
        let mut updates = self.publications.subscribe().updates;
        loop {
            if *stop.borrow() {
                return;
            }
            let origin = self.publications.current();
            if !self.fill(&origin, &mut stop, &mut updates).await {
                continue;
            }
            while Arc::ptr_eq(&self.publications.current().documents, &origin.documents) {
                if *stop.borrow() {
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
        for route in &origin.routes {
            tokio::task::yield_now().await;
            let current = self.publications.current();
            if *stop.borrow() || !Arc::ptr_eq(&current.documents, &origin.documents) {
                return cancelled();
            }
            if current.completed.contains_key(&route.route) {
                continue;
            }
            let work = self
                .work
                .background(origin.documents.clone(), route.route.clone());
            tokio::pin!(work);
            loop {
                tokio::select! {
                    _ = stop.changed() => return cancelled(),
                    _ = updates.recv() => {
                        if !Arc::ptr_eq(&self.publications.current().documents, &origin.documents) { return cancelled(); }
                    },
                    result = &mut work => {
                        if let Err(error) = result { self.diagnostics.failed(&error); }
                        break;
                    }
                }
            }
        }
        let publications = self.publications.clone();
        let origin = origin.clone();
        let routes: Vec<_> = origin
            .routes
            .iter()
            .map(|route| route.route.clone())
            .collect();
        let parent = tracing::Span::current();
        let result = tokio::task::spawn_blocking(move || {
            parent.in_scope(|| publications.completed_many(&origin, &routes))
        })
        .await;
        match result {
            Ok(Ok(())) => {}
            Ok(Err(error)) => self.diagnostics.failed(&error),
            Err(source) => self
                .diagnostics
                .failed(&crate::error::ServerError::Internal(
                    crate::error::InternalError::Task { source },
                )),
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
