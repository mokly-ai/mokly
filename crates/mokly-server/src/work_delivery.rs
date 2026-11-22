//! Generated delivery shares foreground admission and drains with normal render work.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use crate::asset_streams::AssetResult;
use crate::backend::Documents;
use crate::error::{InternalError, Result};
use crate::work::Workers;

impl Workers {
    /// Admit one foreground file read, including its validation, to a blocking worker.
    pub(crate) async fn file_delivery<T: Send + 'static>(
        &self,
        read: impl FnOnce() -> Result<Option<T>> + Send + 'static,
    ) -> Result<Option<T>> {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let guard = self.priority.enter(true);
        if self.closed.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let Ok(permit) = self.workers.clone().acquire_owned().await else {
            return Ok(None);
        };
        if self.closed.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            let _activity = activity;
            parent.in_scope(|| {
                let _guard = guard;
                let _permit = permit;
                read()
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }
    pub(crate) async fn asset_delivery(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> AssetResult {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let guard = self.priority.enter(true);
        if self.closed.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let request = documents.asset_request(&route);
        let Ok(permit) = self.workers.clone().acquire_owned().await else {
            return Ok(None);
        };
        if self.closed.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let parent = tracing::Span::current();
        match tokio::task::spawn_blocking(move || {
            let _activity = activity;
            parent.in_scope(|| {
                let _guard = guard;
                let _permit = permit;
                request.capture()
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(Arc::new(InternalError::Task { source }.into())),
        }
    }
}
