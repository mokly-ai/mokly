//! A separate owner can prepare the first head's base without starting Changes.

use std::sync::Arc;

use tokio::sync::watch;
use tokio::task::JoinHandle;
use tracing::Instrument;

use crate::background::stopped;
use crate::changes::{ChangeCancellation, ChangeToken};
use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, ServerError};
use crate::publication::Publications;
use crate::snapshot::Snapshot;
use crate::usage_completion::UsageCompletion;

/// One blocking startup preparation and its unconditional completion notification.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StartupPreparationMock))]
pub trait StartupPreparation: Send + Sync {
    /// Prepare the pinned base, then retain its outcome for ordinary classification.
    fn prepare(&self) -> bool;
    /// Mark the blocking owner drained, including a failed task join.
    fn finished(&self);
}

/// Consume the first-head opportunity before ordinary usage begins.
pub(crate) fn start(
    origin: Arc<Snapshot>,
    publications: Arc<dyn Publications>,
    diagnostics: Arc<dyn Diagnostics>,
    stop: watch::Receiver<bool>,
    usage: Arc<dyn UsageCompletion>,
) -> Option<JoinHandle<()>> {
    let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let task = origin
        .generation
        .changes
        .as_ref()?
        .startup(cancel.clone(), usage)?;
    let span = tracing::info_span!("review.startup-base", status = "error");
    Some(tokio::spawn(
        supervise(task, cancel, origin, publications, diagnostics, stop).instrument(span),
    ))
}

async fn supervise(
    task: Arc<dyn StartupPreparation>,
    cancel: Arc<dyn ChangeCancellation>,
    origin: Arc<Snapshot>,
    publications: Arc<dyn Publications>,
    diagnostics: Arc<dyn Diagnostics>,
    mut stop: watch::Receiver<bool>,
) {
    let mut updates = publications.subscribe().updates;
    let work = task.clone();
    let parent = tracing::Span::current();
    let mut work = tokio::task::spawn_blocking(move || parent.in_scope(|| work.prepare()));
    let result = loop {
        if stopped(&stop) || !Arc::ptr_eq(&publications.current().documents, &origin.documents) {
            cancel.cancel();
            break work.await;
        }
        tokio::select! {
            result = &mut work => break result,
            _ = stop.changed() => {},
            _ = updates.recv() => {},
        }
    };
    match result {
        Ok(true) if !cancel.cancelled() => {
            tracing::Span::current().record("status", "ok");
        }
        Err(source) => diagnostics.failed(&ServerError::Internal(InternalError::Task { source })),
        _ => {}
    }
    task.finished();
}
