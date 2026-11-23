//! File delivery shares foreground admission and drains with normal render work.

use std::future::{Future, ready};
use std::sync::Arc;
use std::sync::atomic::Ordering;

use crate::asset_streams::{AssetResult, SharedAsset};
use crate::backend::Documents;
use crate::error::{InternalError, Result};
use crate::work::Workers;

impl Workers {
    /// Admit one foreground file read, including its validation, to a blocking worker.
    pub(crate) async fn file_delivery<T: Send + 'static>(
        &self,
        read: impl FnOnce() -> Result<Option<T>> + Send + 'static,
    ) -> Result<Option<T>> {
        self.prepared_file_delivery(ready(Ok(Some(read)))).await
    }

    /// Check public membership off the event loop and wait for the route before a worker.
    pub(crate) async fn authored_delivery(
        &self,
        documents: Arc<dyn Documents>,
        path: String,
    ) -> Result<Option<SharedAsset>> {
        self.prepared_file_delivery(async move {
            let parent = tracing::Span::current();
            let request = tokio::task::spawn_blocking(move || {
                parent.in_scope(|| documents.authored_request(path))
            })
            .await;
            match request {
                Ok(Some(request)) => Ok(Some(request.admit().await)),
                Ok(None) => Ok(None),
                Err(source) => Err(InternalError::Task { source }.into()),
            }
        })
        .await
    }

    async fn prepared_file_delivery<T, Read>(
        &self,
        prepare: impl Future<Output = Result<Option<Read>>> + Send,
    ) -> Result<Option<T>>
    where
        T: Send + 'static,
        Read: FnOnce() -> Result<Option<T>> + Send + 'static,
    {
        let activity = self.activity.as_ref().map(|activity| activity.enter());
        let guard = self.priority.enter(true);
        if self.closed.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let Some(read) = prepare.await? else {
            return Ok(None);
        };
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
