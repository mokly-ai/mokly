//! Changes begins after current usage and restarts only for new heads or Git refs.

use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use mokly_model::material::digest;
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::watch;
use tokio::time;

use crate::background::stopped;
use crate::changes::{
    self, Accepted, ChangeCancellation, ChangeProgress, ChangeSource, ChangeToken, Commit,
};
use crate::comparison_store::Comparisons;
use crate::diagnostics::Diagnostics;
use crate::error::{InternalError, Result, ServerError};
use crate::publication::Publications;
use crate::snapshot::{Snapshot, encode};

/// Continuation of the foreground-priority current usage pass.
#[async_trait]
pub trait AfterUsage: Send + Sync {
    /// Classify and observe Git until this head is replaced or Serve stops.
    async fn run(&self, origin: Arc<Snapshot>, stop: watch::Receiver<bool>);
}

/// The HTTP loop never runs Git, prepares a base, or waits for classification.
#[derive(Clone)]
pub struct ChangesPass {
    /// Atomic public state and revision fences.
    pub publications: Arc<dyn Publications>,
    /// Retained immutable files, with separate selected capture admission.
    pub comparisons: Arc<dyn Comparisons>,
    /// Projection failures use the normal diagnostic path.
    pub diagnostics: Arc<dyn Diagnostics>,
    /// Snapshot Serve does not poll Git refs.
    pub watching: bool,
}

#[async_trait]
impl AfterUsage for ChangesPass {
    async fn run(&self, origin: Arc<Snapshot>, mut stop: watch::Receiver<bool>) {
        if stopped(&stop) {
            return;
        }
        let Some(mut source) = origin.generation.changes.clone() else {
            return;
        };
        let mut updates = self.publications.subscribe().updates;
        let mut queued = None;
        let mut poll = time::interval_at(
            time::Instant::now() + Duration::from_secs(1),
            Duration::from_secs(1),
        );
        poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        while !stopped(&stop) && self.current(&origin) {
            let references = match queued.take() {
                Some(references) => references,
                None => match self.reference(source.clone(), &origin, &mut stop).await {
                    Some(references) => references,
                    None => return,
                },
            };
            let expected = references.as_ref().ok().cloned();
            let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
            let owner = self.clone();
            let head = origin.clone();
            let task_source = source.clone();
            let task_cancel = cancel.clone();
            let mut work = tokio::task::spawn_blocking(move || {
                owner.execute(head, task_source, task_cancel, references)
            });
            let mut refresh = false;
            let mut settled = false;
            loop {
                if stopped(&stop) || !self.current(&origin) {
                    cancel.cancel();
                    break;
                }
                tokio::select! {
                    result = &mut work => {
                        if let Err(source) = result { self.diagnostics.failed(&ServerError::Internal(InternalError::Task { source })); }
                        settled = true;
                        break;
                    },
                    _ = stop.changed() => {},
                    _ = updates.recv() => {},
                    _ = poll.tick(), if self.watching => {
                        self.comparisons.collect();
                        let Some(next) = self.reference(source.clone(), &origin, &mut stop).await else { cancel.cancel(); break; };
                        if next.as_ref().ok() != expected.as_ref() {
                            cancel.cancel(); queued = Some(next); refresh = true; break;
                        }
                    },
                }
            }
            if !settled {
                let _ = work.await;
            }
            if stopped(&stop) || !self.current(&origin) {
                return;
            }
            if refresh {
                if let Some(next) = source.refreshed() {
                    source = next;
                }
                continue;
            }
            loop {
                if stopped(&stop) || !self.current(&origin) {
                    return;
                }
                tokio::select! {
                    _ = stop.changed() => {},
                    _ = updates.recv() => {},
                    _ = poll.tick() => {
                        self.comparisons.collect();
                        if self.watching {
                            let Some(next) = self.reference(source.clone(), &origin, &mut stop).await else { return; };
                            if next.as_ref().ok() != expected.as_ref() { queued = Some(next); break; }
                        }
                    },
                }
            }
            if stopped(&stop) || !self.current(&origin) {
                return;
            }
            if let Some(next) = source.refreshed() {
                source = next;
            }
        }
    }
}

impl ChangesPass {
    fn current(&self, origin: &Snapshot) -> bool {
        Arc::ptr_eq(&self.publications.current().documents, &origin.documents)
    }

    fn execute(
        &self,
        origin: Arc<Snapshot>,
        source: Arc<dyn ChangeSource>,
        cancel: Arc<dyn ChangeCancellation>,
        references: Result<String>,
    ) {
        let started = Instant::now();
        let phase = source.started(cancel.clone());
        let progress: Arc<dyn ChangeProgress> = Arc::new(Progress {
            publications: self.publications.clone(),
            origin: origin.clone(),
            cancel: cancel.clone(),
        });
        let result = (|| {
            if !progress.status(ChangesStatus::Pending)? {
                return Err(ServerError::ChangesReplaced);
            }
            let references = references?;
            let result = source.classify(cancel.clone(), progress)?;
            if cancel.cancelled() || !self.current(&origin) {
                return Err(ServerError::ChangesReplaced);
            }
            let identity = encode(&(
                &result.review,
                &result.snapshot,
                result.after.generation_key(),
            ))?;
            let accepted = Arc::new(Accepted {
                source: Some(source.clone()),
                cancel: cancel.clone(),
                id: digest(&identity.bytes),
                result,
            });
            let files = changes::metadata(&accepted, &origin)?;
            if self.watching && source.references(cancel.clone())? != references {
                return Err(ServerError::ChangesReplaced);
            }
            if cancel.cancelled() || !self.current(&origin) {
                return Err(ServerError::ChangesReplaced);
            }
            self.comparisons.install(accepted.clone(), files)?;
            if self.publications.changes(
                &origin,
                ChangesStatus::Ready,
                Some(accepted.clone()),
                cancel.as_ref(),
            )? && !cancel.cancelled()
            {
                cancel.commit(&Commit(&|| {
                    if let Some(phase) = &phase {
                        phase.finish();
                    }
                    source.finished(Ok(&accepted.result), started.elapsed());
                    true
                }));
            }
            Ok(())
        })();
        if let Err(error) = result
            && !cancel.cancelled()
            && !matches!(error, ServerError::ChangesReplaced)
        {
            match self.publications.changes(
                &origin,
                ChangesStatus::Unavailable,
                None,
                cancel.as_ref(),
            ) {
                Ok(true) => {
                    cancel.commit(&Commit(&|| {
                        if let Some(phase) = &phase {
                            phase.finish();
                        }
                        source.finished(Err(&error), started.elapsed());
                        true
                    }));
                }
                Err(error) => self.diagnostics.failed(&error),
                _ => {}
            }
        }
    }

    async fn reference(
        &self,
        source: Arc<dyn ChangeSource>,
        origin: &Snapshot,
        stop: &mut watch::Receiver<bool>,
    ) -> Option<Result<String>> {
        if stopped(stop) || !self.current(origin) {
            return None;
        }
        let cancel: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
        let task_cancel = cancel.clone();
        let mut work = tokio::task::spawn_blocking(move || source.references(task_cancel));
        let mut updates = self.publications.subscribe().updates;
        loop {
            if stopped(stop) || !self.current(origin) {
                cancel.cancel();
                let _ = work.await;
                return None;
            }
            tokio::select! {
                result = &mut work => return Some(match result { Ok(result) => result, Err(source) => Err(InternalError::Task { source }.into()) }),
                _ = stop.changed() => {},
                _ = updates.recv() => {},
            }
        }
    }
}

struct Progress {
    publications: Arc<dyn Publications>,
    origin: Arc<Snapshot>,
    cancel: Arc<dyn ChangeCancellation>,
}
impl ChangeProgress for Progress {
    fn status(&self, status: ChangesStatus) -> Result<bool> {
        if self.cancel.cancelled() {
            return Ok(false);
        }
        self.publications
            .changes(&self.origin, status, None, self.cancel.as_ref())
    }
}

#[cfg(test)]
#[path = "_tests_/changes_background_tests.rs"]
mod changes_background_tests;

#[cfg(test)]
#[path = "_tests_/changes_scheduling_tests.rs"]
mod changes_scheduling_tests;
