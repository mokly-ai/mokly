//! One fixed segment buffer stays inside its exact process-cache reservation.

use std::sync::Arc;

use mokly_graph::cache::RenderCache;
use mokly_graph::cache_export::{CacheOperation, EncodedConsumer};
use mokly_graph::document_codec::EncodedView;
use mokly_graph::export_memory::ExportObserver;

use crate::render_admission::Admission;
use crate::render_memory::{ExportMemory, SegmentMemory};
use crate::render_pending::{Request, Shared};
use crate::render_segment_buffer::{Append, SegmentBuffer};
use crate::render_store::{DocumentBackend, WriteOutcome};

pub(crate) struct Batch<'a> {
    pub(crate) shared: Arc<Shared>,
    pub(crate) admission: &'a Admission,
    pub(crate) requests: &'a [Request],
    pub(crate) cache: Arc<dyn RenderCache>,
    pub(crate) backend: Arc<dyn DocumentBackend>,
    pub(crate) limit: usize,
    pub(crate) written: usize,
    pub(crate) bytes: usize,
    pub(crate) unavailable: bool,
}

struct Encode<'a> {
    request: &'a Request,
    buffer: &'a mut SegmentBuffer,
    outcome: Append,
    memory: Arc<dyn ExportObserver>,
}
impl EncodedConsumer for Encode<'_> {
    fn memory(&self) -> Option<Arc<dyn ExportObserver>> {
        Some(self.memory.clone())
    }
    fn consume(&mut self, document: &EncodedView) {
        self.outcome = self
            .buffer
            .append(&self.request.key, document, Some(self.memory.as_ref()));
    }
}

impl CacheOperation for Batch<'_> {
    fn run(&mut self) {
        let _memory = SegmentMemory(self.shared.clone());
        let Some(mut buffer) = SegmentBuffer::new(self.limit) else {
            return;
        };
        self.shared.memory(None, buffer.known_bytes());
        let memory: Arc<dyn ExportObserver> = Arc::new(ExportMemory(self.shared.clone()));
        for request in self.requests {
            if !self.admission.ready() {
                return;
            }
            let mut encoder = Encode {
                request,
                buffer: &mut buffer,
                outcome: Append::Skipped,
                memory: memory.clone(),
            };
            self.cache.with_encoded(&request.document, &mut encoder);
            if encoder.outcome == Append::Full {
                if !self.publish(&mut buffer) {
                    return;
                }
                buffer.advance();
            }
        }
        self.publish(&mut buffer);
    }
}

impl Batch<'_> {
    #[tracing::instrument(name = "render.store.write", skip_all)]
    fn publish(&mut self, buffer: &mut SegmentBuffer) -> bool {
        if !self.admission.ready() {
            return false;
        }
        let Some(built) = buffer.finish(self.backend.version()) else {
            return false;
        };
        let outcome = self.backend.save(&built);
        if matches!(outcome, WriteOutcome::WrittenWithStoreFault(_)) {
            self.unavailable = true;
        }
        match outcome {
            WriteOutcome::Written(written) | WriteOutcome::WrittenWithStoreFault(written) => {
                self.written += written;
                self.bytes += built.payload_bytes;
            }
            WriteOutcome::Unavailable => self.unavailable = true,
            WriteOutcome::Skipped => {}
        }
        matches!(outcome, WriteOutcome::Written(_))
    }
}
