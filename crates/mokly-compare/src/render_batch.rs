//! One active segment batch stays inside a process-cache scratch reservation.

use std::sync::Arc;

use mokly_graph::cache::RenderCache;
use mokly_graph::cache_export::{CacheOperation, EncodedConsumer};
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::StoredDocument;

use crate::render_pending::Request;
use crate::render_store::{DocumentBackend, WriteOutcome};

pub(crate) struct Batch<'a> {
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
    remaining: usize,
    record: Option<StoredDocument>,
}
impl EncodedConsumer for Encode<'_> {
    fn consume(&mut self, document: &EncodedView) {
        if let Ok(Some(bytes)) = document.stored(self.remaining) {
            self.record = Some(StoredDocument {
                key: self.request.key.clone(),
                bytes,
            });
        }
    }
}

impl CacheOperation for Batch<'_> {
    fn run(&mut self) {
        let mut documents = Vec::new();
        let mut bytes = 0usize;
        for request in self.requests {
            let mut encoder = Encode {
                request,
                remaining: self.limit.saturating_sub(64),
                record: None,
            };
            self.cache.with_encoded(&request.document, &mut encoder);
            if let Some(document) = encoder.record {
                if bytes
                    .saturating_add(document.bytes.len())
                    .saturating_add(64)
                    > self.limit
                {
                    if !self.publish(&documents, bytes) {
                        return;
                    }
                    documents.clear();
                    bytes = 0;
                }
                bytes += document.bytes.len() + 64;
                documents.push(document);
            }
        }
        if documents.is_empty() {
            return;
        }
        self.publish(&documents, bytes);
    }
}

impl Batch<'_> {
    #[tracing::instrument(name = "render.store.write", skip_all)]
    fn publish(&mut self, documents: &[StoredDocument], bytes: usize) -> bool {
        let outcome = self.backend.save(documents);
        if matches!(outcome, WriteOutcome::WrittenWithStoreFault(_)) {
            self.unavailable = true;
        }
        match outcome {
            WriteOutcome::Written(written) | WriteOutcome::WrittenWithStoreFault(written) => {
                self.written += written;
                self.bytes += bytes;
            }
            WriteOutcome::Unavailable => self.unavailable = true,
            WriteOutcome::Skipped => {}
        }
        matches!(outcome, WriteOutcome::Written(_))
    }
}
