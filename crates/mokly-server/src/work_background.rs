//! A lookup releases its worker and route lock before a real miss waits for admission.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::background::Completion;
use mokly_graph::render_class::RenderClass;
use mokly_graph::write_activity::WriteLease;
use tokio::sync::OwnedSemaphorePermit;

use crate::backend::Documents;
use crate::background_admission::BatchPlace;
use crate::background_dispatch::Dispatch;
use crate::background_read::BackgroundMiss;
use crate::background_read::BackgroundRead;
use crate::background_stage::Running;
use crate::error::{InternalError, Result};
use crate::priority::Guard;
use crate::work::Workers;
use crate::work_active::Job;

struct Lifetime {
    _activity: Option<Box<dyn WriteLease>>,
    _active: Job,
}

struct LookupJob {
    documents: Arc<dyn Documents>,
    route: String,
    parent: tracing::Span,
    worker: HeldWorker,
    lifetime: Lifetime,
}

/// The worker permit and the priority guard of a lookup job. The job returns them, so the
/// render's task, not the job's thread, frees the worker after the join, right before it
/// queues its miss. A caller that polls its renders in request order, as the usage pass
/// does, then keeps that order: a later render cannot take the worker for both of its jobs
/// first. The permit drops before the guard, so the worker is free when the guard wakes the
/// waiters.
struct HeldWorker {
    _permit: OwnedSemaphorePermit,
    _guard: Guard,
}

struct ResumeJob {
    attempt: Box<dyn BackgroundMiss>,
    running: Option<Running>,
    _permit: Option<OwnedSemaphorePermit>,
    _batch: Option<BatchPlace>,
    _guard: Guard,
    _lifetime: Lifetime,
}

impl LookupJob {
    fn run(self) -> (Result<Option<BackgroundRead>>, Lifetime, HeldWorker) {
        let read = RenderClass::Background.in_scope(|| {
            self.parent
                .in_scope(|| self.documents.background_read(&self.route))
        });
        (read, self.lifetime, self.worker)
    }
}

impl ResumeJob {
    fn run(self, parent: tracing::Span) -> Result<Vec<Warning>> {
        let completion = self
            .running
            .as_ref()
            .map(|running| -> Arc<dyn Completion> { running.0.clone() });
        RenderClass::Background.in_scope(|| parent.in_scope(|| self.attempt.complete(completion)))
    }
}

struct Ordinary {
    documents: Arc<dyn Documents>,
    route: String,
}

impl BackgroundMiss for Ordinary {
    fn root_eligible(&self) -> bool {
        false
    }

    fn complete(self: Box<Self>, _completion: Option<Arc<dyn Completion>>) -> Result<Vec<Warning>> {
        self.documents.background(&self.route)
    }
}

impl Workers {
    pub(crate) async fn background_render(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
        dispatch: Arc<Dispatch>,
    ) -> Result<Vec<Warning>> {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let Some(permit) = self.background_permit().await else {
            return Ok(Vec::new());
        };
        let fallback = documents.clone();
        let lookup = LookupJob {
            documents,
            route: route.clone(),
            parent: tracing::Span::current(),
            worker: HeldWorker {
                _permit: permit,
                _guard: self.priority.enter(false),
            },
            lifetime: Lifetime {
                _activity: activity,
                _active: self.background_jobs.start(),
            },
        };
        let (read, lifetime) = match tokio::task::spawn_blocking(move || lookup.run()).await {
            Ok((read, lifetime, _worker)) => (read, lifetime),
            Err(source) => return Err(InternalError::Task { source }.into()),
        };
        let miss = match read? {
            Some(BackgroundRead::Complete(warnings)) => return Ok(warnings),
            Some(BackgroundRead::Miss(miss)) => miss,
            None => Box::new(Ordinary {
                documents: fallback,
                route: route.clone(),
            }),
        };
        let admission = dispatch.stages.batch.acquire();
        tokio::pin!(admission);
        let batch = loop {
            let changed = self.priority.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            if self.closed.load(Ordering::SeqCst) {
                return Ok(Vec::new());
            }
            tokio::select! {
                batch = &mut admission => {
                    let Some(batch) = batch else { return Ok(Vec::new()); };
                    break batch;
                },
                _ = changed => {},
            }
        };
        let Some(permit) = self.background_permit().await else {
            return Ok(Vec::new());
        };
        let stage = miss
            .root_eligible()
            .then(|| dispatch.stages.view_dispatched(&route, dispatch.clone()));
        let (permit, batch) = if let Some(stage) = &stage {
            stage.attach(permit, self.priority.clone());
            stage.attach_batch(batch);
            (None, None)
        } else {
            (Some(permit), Some(batch))
        };
        let physical = ResumeJob {
            attempt: miss,
            running: stage.map(Running),
            _permit: permit,
            _batch: batch,
            _guard: self.priority.enter(false),
            _lifetime: lifetime,
        };
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || physical.run(parent)).await {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }

    async fn background_permit(&self) -> Option<OwnedSemaphorePermit> {
        let _turn = self.turn.acquire().await.ok()?;
        loop {
            let changed = self.priority.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            if self.closed.load(Ordering::SeqCst) {
                return None;
            }
            if self.priority.idle()
                && let Ok(permit) = self.workers.clone().try_acquire_owned()
            {
                return Some(permit);
            }
            changed.await;
        }
    }
}
