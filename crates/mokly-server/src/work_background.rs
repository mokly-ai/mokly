//! Background admission yields to foreground work and admits queued renders in order.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::render_class::RenderClass;
use tokio::sync::OwnedSemaphorePermit;

use crate::backend::Documents;
use crate::background_stage::{Running, Stage};
use crate::error::{InternalError, Result};
use crate::work::Workers;

impl Workers {
    /// Sidecar-stage owners keep their worker while later completion calls use the
    /// existing sidecar gate. Completion never waits for another worker, so this
    /// ownership cannot create a cycle between those calls and dispatch admission.
    pub(crate) async fn background_stage_render(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
        stage: Arc<Stage>,
    ) -> Result<Vec<Warning>> {
        self.background_job(documents, route, Some(stage)).await
    }

    pub(crate) async fn background_render(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Vec<Warning>> {
        self.background_job(documents, route, None).await
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

    async fn background_job(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
        stage: Option<Arc<Stage>>,
    ) -> Result<Vec<Warning>> {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let Some(permit) = self.background_permit().await else {
            return Ok(Vec::new());
        };
        let permit = if let Some(stage) = &stage {
            stage.attach(permit, self.priority.clone());
            None
        } else {
            Some(permit)
        };
        let active = self.background_jobs.start();
        let guard = self.priority.enter(false);
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            let _active = active;
            let _activity = activity;
            let _running = stage.as_ref().map(|stage| Running(stage.clone()));
            RenderClass::Background.in_scope(|| {
                parent.in_scope(|| {
                    let _guard = guard;
                    let _permit = permit;
                    match stage {
                        Some(stage) => documents.background_staged(&route, stage),
                        None => documents.background(&route),
                    }
                })
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }
}
