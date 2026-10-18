//! Classify once, then retry bounded metadata installation without repeating render work.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mokly_model::material::digest;
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::Notify;

use crate::assets::File;
use crate::changes::{self, Accepted, ChangeCancellation, ChangeProgress, ChangeSource, Commit};
use crate::changes_background::ChangesPass;
use crate::changes_install::MetadataInstallation;
use crate::changes_signal::ChangeSignal;
use crate::comparison_capture::MAX_BYTES;
use crate::error::{InternalError, Result, ServerError};
use crate::publication::Publications;
use crate::snapshot::{Snapshot, encode};

impl ChangesPass {
    #[tracing::instrument(name = "changes.classify", skip_all, fields(status = "error"))]
    pub(crate) async fn execute(
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
        let owner = self.clone();
        let head = origin.clone();
        let input = source.clone();
        let token = cancel.clone();
        let parent = tracing::Span::current();
        let work = tokio::task::spawn_blocking(move || {
            parent.in_scope(|| owner.prepare(head, input, token, progress, references))
        })
        .await;
        let result = match work {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        };
        let result = match result {
            Ok((accepted, files)) => {
                match self.publish(origin.clone(), accepted.clone(), files).await {
                    Ok(true) => {
                        tracing::Span::current().record("status", "ok");
                        cancel.commit(&Commit(&|| {
                            if let Some(phase) = &phase {
                                phase.finish();
                            }
                            source.finished(Ok(&accepted.result), started.elapsed());
                            true
                        }));
                        Ok(())
                    }
                    Ok(_) => Ok(()),
                    Err(error) => Err(error),
                }
            }
            Err(error) => Err(error),
        };
        if let Err(error) = result
            && !cancel.cancelled()
            && !matches!(error, ServerError::ChangesReplaced)
        {
            let owner = self.clone();
            let parent = tracing::Span::current();
            let reporting = tokio::task::spawn_blocking(move || {
                parent.in_scope(|| {
                    match owner.publications.changes(
                        &origin,
                        ChangesStatus::Unavailable,
                        None,
                        cancel.as_ref(),
                        None,
                    ) {
                        Ok(true) => {
                            tracing::Span::current().record("status", "ok");
                            cancel.commit(&Commit(&|| {
                                if let Some(phase) = &phase {
                                    phase.finish();
                                }
                                source.finished(Err(&error), started.elapsed());
                                true
                            }));
                        }
                        Err(error) => owner.diagnostics.failed(&error),
                        _ => {}
                    }
                })
            })
            .await;
            if let Err(source) = reporting {
                self.diagnostics
                    .failed(&ServerError::Internal(InternalError::Task { source }));
            }
        }
    }

    fn prepare(
        &self,
        origin: Arc<Snapshot>,
        source: Arc<dyn ChangeSource>,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
        references: Result<String>,
    ) -> Result<(Arc<Accepted>, BTreeMap<String, File>)> {
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
        if files.values().map(|file| file.bytes.len()).sum::<usize>() > MAX_BYTES {
            return Err(ServerError::ComparisonMetadataTooLarge);
        }
        if self.watching && source.references(cancel.clone())? != references {
            return Err(ServerError::ChangesReplaced);
        }
        Ok((accepted, files))
    }

    async fn publish(
        &self,
        origin: Arc<Snapshot>,
        accepted: Arc<Accepted>,
        files: BTreeMap<String, File>,
    ) -> Result<bool> {
        let files = Arc::new(files);
        let wake = Arc::new(RetryWake(Notify::new()));
        let listener: Arc<dyn ChangeSignal> = wake.clone();
        accepted.cancel.observe(Arc::downgrade(&listener));
        loop {
            if accepted.cancel.cancelled() || !self.current(&origin) {
                return Ok(false);
            }
            let result = self
                .install_ready(origin.clone(), accepted.clone(), files.clone())
                .await;
            match result {
                Err(ServerError::ComparisonCapacity) => {
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(1)) => {},
                        _ = wake.0.notified() => {},
                    }
                }
                result => return result,
            }
        }
    }

    async fn install_ready(
        &self,
        origin: Arc<Snapshot>,
        accepted: Arc<Accepted>,
        files: Arc<BTreeMap<String, File>>,
    ) -> Result<bool> {
        self.comparisons.check_capacity(&accepted, &files)?;
        let owner = self.clone();
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            parent.in_scope(|| {
                owner.publications.changes(
                    &origin,
                    ChangesStatus::Ready,
                    Some(accepted.clone()),
                    accepted.cancel.as_ref(),
                    Some(&MetadataInstallation {
                        store: owner.comparisons.as_ref(),
                        accepted: &accepted,
                        files: &files,
                    }),
                )
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }
}

struct RetryWake(Notify);
impl ChangeSignal for RetryWake {
    fn notify(&self) {
        self.0.notify_one();
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
            .changes(&self.origin, status, None, self.cancel.as_ref(), None)
    }
}

#[cfg(test)]
#[path = "_tests_/changes_retry_tests.rs"]
mod changes_retry_tests;

#[cfg(test)]
#[path = "_tests_/changes_trace_tests.rs"]
mod changes_trace_tests;
