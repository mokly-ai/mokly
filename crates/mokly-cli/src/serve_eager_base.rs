//! Normal post-usage classification adopts one pending graph or prepares serially.

use std::sync::{Arc, Mutex};

use mokly_compare::base_render::{
    BasePreparationResult, BaseProvider, BaseRequest, HistoricalSources,
};
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::{Error, Result};
use mokly_graph::workers::RenderWorkers;
use mokly_server::changes::ChangeCancellation;

use crate::changes_base_sources::NativePhases;
use crate::serve_base_cancel::BaseLifetime;
use crate::serve_eager::{AdoptedPreparation, PendingBase};
use crate::serve_eager_events::PreparationSink;
use crate::serve_eager_lifetime::LifetimeSelection;

pub(super) struct ReadyPreparation {
    prepared: BasePreparationResult,
    native: Arc<dyn NativePhases>,
}

pub(super) struct AdoptingBase {
    pub(super) pending: Option<Arc<dyn PendingBase>>,
    pub(super) inner: Arc<dyn BaseProvider>,
    pub(super) lifetime: Arc<dyn LifetimeSelection>,
    pub(super) serial: Arc<dyn BaseLifetime>,
    pub(super) cancel: Arc<dyn ChangeCancellation>,
    pub(super) operation: Arc<dyn ChangeCancellation>,
    pub(super) workers: Arc<dyn RenderWorkers>,
    pub(super) sink: Arc<dyn PreparationSink>,
    pub(super) ready: Mutex<Option<ReadyPreparation>>,
}

impl BaseProvider for AdoptingBase {
    fn historical_sources(
        &self,
        request: &BaseRetentionRequest<'_>,
    ) -> Result<Option<HistoricalSources>> {
        let Some(pending) = &self.pending else {
            return Ok(None);
        };
        let Some(adopted) = pending.adopt(request, self.cancel.clone(), self.operation.clone())?
        else {
            return Ok(None);
        };
        let AdoptedPreparation {
            sources,
            prepared,
            native,
            lifetime,
            workers,
            events,
        } = adopted;
        self.lifetime.select(lifetime);
        workers.adopt(self.workers.clone());
        if !matches!(events.adopt(self.sink.clone()), Ok(true)) {
            return Err(Error::Cancelled);
        }
        let sources = sources?;
        let Some(prepared) = prepared else {
            return Err(Error::Cancelled);
        };
        *self.ready.lock().unwrap_or_else(|error| error.into_inner()) =
            Some(ReadyPreparation { prepared, native });
        Ok(Some(sources))
    }

    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        let ready = self
            .ready
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        match ready {
            Some(ready) => ready.native.admit(ready.prepared?),
            None => {
                self.lifetime.select(self.serial.clone());
                self.inner.prepare(request)
            }
        }
    }
}
