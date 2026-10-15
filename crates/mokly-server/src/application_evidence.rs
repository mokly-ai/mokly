//! CPU-bound publication work stays outside the HTTP event loop.

use std::sync::Arc;

use crate::application::Application;
use crate::error::{InternalError, ServerError};
use crate::snapshot::Snapshot;

impl Application {
    pub(crate) async fn completed(&self, origin: Arc<Snapshot>, route: String) {
        let publications = self.publications.clone();
        match tokio::task::spawn_blocking(move || publications.completed(&origin, &route)).await {
            Ok(Ok(())) => {}
            Ok(Err(error)) => self.diagnostics.failed(&error),
            Err(source) => self
                .diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source })),
        }
    }
    pub(crate) async fn close_publications(&self) {
        let publications = self.publications.clone();
        if let Err(source) = tokio::task::spawn_blocking(move || publications.close()).await {
            self.diagnostics
                .failed(&ServerError::Internal(InternalError::Task { source }));
        }
    }
}
