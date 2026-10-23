//! Generated delivery shares foreground admission and drains with normal render work.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use crate::assets::File;
use crate::backend::Documents;
use crate::error::{InternalError, Result};
use crate::public_read::OpenedFile;
use crate::work::Workers;

impl Workers {
    pub(crate) async fn generated_delivery(
        &self,
        documents: Arc<dyn Documents>,
        route: String,
    ) -> Result<Option<File>> {
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
            parent.in_scope(|| {
                let _guard = guard;
                let _permit = permit;
                let documents = documents;
                documents.generated(&route)
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
    ) -> Result<Option<OpenedFile>> {
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
            parent.in_scope(|| {
                let _guard = guard;
                let _permit = permit;
                documents.asset(&route)
            })
        })
        .await
        {
            Ok(result) => result,
            Err(source) => Err(InternalError::Task { source }.into()),
        }
    }
}
