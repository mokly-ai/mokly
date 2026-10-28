//! Background admission yields to foreground work and admits queued renders in order.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_catalogue::diagnostic::Warning;

use crate::backend::Documents;
use crate::error::{InternalError, Result};
use crate::work::Workers;

impl Workers {
    /// Wait for the fair turn, then for an idle foreground and a free worker, and render
    /// on a blocking thread. The warnings return unreported.
    pub(crate) async fn background_render(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Vec<Warning>> {
        let permit = {
            let Ok(_turn) = self.turn.acquire().await else {
                return Ok(Vec::new());
            };
            loop {
                let changed = self.priority.changed.notified();
                tokio::pin!(changed);
                changed.as_mut().enable();
                if self.closed.load(Ordering::SeqCst) {
                    return Ok(Vec::new());
                }
                if self.priority.idle()
                    && let Ok(permit) = self.workers.clone().try_acquire_owned()
                {
                    break permit;
                }
                changed.await;
            }
        };
        let guard = self.priority.enter(false);
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            parent.in_scope(|| {
                let _guard = guard;
                let _permit = permit;
                documents.background(&route)
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }
}
