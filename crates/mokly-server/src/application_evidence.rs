//! One application-owned task coalesces document completions outside request work.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use tokio::sync::Notify;
use tokio::task::JoinHandle;

use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, ServerError};
use crate::publication::Publications;
use crate::snapshot::Snapshot;

#[async_trait]
pub(crate) trait EvidencePublisher: Send + Sync {
    fn completed(&self, origin: Arc<Snapshot>, route: String);
    async fn close(&self);
}

#[derive(Default)]
struct Pending {
    closed: bool,
    origin: Option<Arc<Snapshot>>,
    routes: BTreeSet<String>,
}

pub(crate) struct CompletionQueue {
    pending: Arc<Mutex<Pending>>,
    ready: Arc<Notify>,
    task: Mutex<Option<JoinHandle<()>>>,
    publications: Arc<dyn Publications>,
    diagnostics: Arc<dyn Diagnostics>,
}

impl CompletionQueue {
    pub(crate) fn new(
        publications: Arc<dyn Publications>,
        diagnostics: Arc<dyn Diagnostics>,
    ) -> Self {
        let pending = Arc::new(Mutex::new(Pending::default()));
        let ready = Arc::new(Notify::new());
        let task = tokio::spawn(publish(
            pending.clone(),
            ready.clone(),
            publications.clone(),
            diagnostics.clone(),
        ));
        Self {
            pending,
            ready,
            task: Mutex::new(Some(task)),
            publications,
            diagnostics,
        }
    }
}

#[async_trait]
impl EvidencePublisher for CompletionQueue {
    fn completed(&self, origin: Arc<Snapshot>, route: String) {
        if !origin.views.contains_key(&route) {
            return;
        }
        let mut pending = self
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if pending.closed {
            return;
        }
        let current = self.publications.current();
        if !Arc::ptr_eq(&current.generation, &origin.generation)
            || current.completed.contains_key(&route)
        {
            return;
        }
        if pending
            .origin
            .as_ref()
            .is_none_or(|old| !Arc::ptr_eq(&old.generation, &origin.generation))
        {
            pending.routes.clear();
            pending.origin = Some(origin);
        }
        if pending.routes.insert(route) {
            self.ready.notify_one();
        }
    }

    async fn close(&self) {
        {
            let mut pending = self
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            pending.closed = true;
            pending.origin = None;
            pending.routes.clear();
        }
        self.ready.notify_one();
        let publications = self.publications.clone();
        if let Err(source) = tokio::task::spawn_blocking(move || publications.close()).await {
            self.diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source }));
        }
        let task = self
            .task
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(task) = task
            && let Err(source) = task.await
        {
            self.diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source }));
        }
    }
}

impl Drop for CompletionQueue {
    fn drop(&mut self) {
        self.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .closed = true;
        self.ready.notify_one();
    }
}

async fn publish(
    pending: Arc<Mutex<Pending>>,
    ready: Arc<Notify>,
    publications: Arc<dyn Publications>,
    diagnostics: Arc<dyn Diagnostics>,
) {
    loop {
        ready.notified().await;
        let batch = {
            let mut pending = pending.lock().unwrap_or_else(|error| error.into_inner());
            if pending.closed {
                return;
            }
            pending
                .origin
                .take()
                .map(|origin| (origin, std::mem::take(&mut pending.routes)))
        };
        let Some((origin, routes)) = batch else {
            continue;
        };
        let publications = publications.clone();
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            parent.in_scope(|| {
                publications.completed_many(&origin, &routes.into_iter().collect::<Vec<_>>())
            })
        })
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(error)) => diagnostics.failed(&error),
            Err(source) => {
                diagnostics.failed(&ServerError::Internal(InternalError::Task { source }))
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/publication_queue_tests.rs"]
mod publication_queue_tests;
