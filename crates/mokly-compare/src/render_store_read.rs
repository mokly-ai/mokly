//! Persistent hits retain valid compositions when optional access maintenance fails.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};

use crate::render_segment;
use crate::render_store::{CachedDocuments, SegmentIdentity, SegmentPosition};

impl CachedDocuments {
    pub(crate) fn read_document(&self, key: &StoreKey) -> ReadOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return ReadOutcome::Miss;
        }
        let (segment, mut store_fault) = {
            let Ok(mut index) = self.index.try_lock() else {
                return ReadOutcome::Miss;
            };
            let fault = match self.initialize(&mut index) {
                Ok(Some(fault)) => fault,
                Ok(None) => return ReadOutcome::Miss,
                Err(error) => return self.failed(error),
            };
            (
                index.as_ref().and_then(|entries| entries.get(key)).cloned(),
                fault,
            )
        };
        if let Some(fault) = self
            .faults
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .pop_front()
        {
            return if store_fault {
                self.enabled.store(false, Ordering::Release);
                ReadOutcome::RejectedWithStoreFault(fault)
            } else {
                ReadOutcome::Rejected(fault)
            };
        }
        let Some(position) = segment else {
            return if store_fault {
                self.enabled.store(false, Ordering::Release);
                ReadOutcome::Unavailable
            } else {
                ReadOutcome::Miss
            };
        };
        let segment = &position.segment.key;
        let mut entry = match self.opened(segment, false) {
            Ok(Some(entry)) => entry,
            Ok(None) => {
                return self
                    .faults
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .pop_front()
                    .map_or(ReadOutcome::Miss, ReadOutcome::Rejected);
            }
            Err(error) => return self.failed(error),
        };
        let token = entry.token;
        let bytes = entry.bytes;
        let replaced = token != position.segment.token || bytes != position.segment.bytes;
        let decoded = render_segment::header(entry.input.as_mut(), bytes, &self.version, replaced)
            .and_then(|(header, start, digest)| {
                if !replaced
                    && (digest != position.segment.header_digest
                        || start != position.segment.start
                        || !header.documents.iter().any(|document| {
                            document.key == key.0
                                && document.offset == position.offset
                                && document.bytes == position.length
                                && document.digest == position.digest
                        }))
                {
                    return Err(EntryFault::Damaged);
                }
                if replaced
                    && let Some(document) = header
                        .documents
                        .iter()
                        .find(|document| document.key == key.0)
                {
                    let segment = Arc::new(SegmentIdentity {
                        key: segment.clone(),
                        header_digest: digest,
                        token,
                        bytes,
                        start,
                    });
                    let adopted = SegmentPosition {
                        segment,
                        offset: document.offset,
                        length: document.bytes,
                        digest: document.digest.clone(),
                    };
                    if let Ok(mut index) = self.index.try_lock()
                        && let Some(index) = index.as_mut()
                    {
                        index.insert(key.clone(), adopted);
                    }
                }
                render_segment::document(entry.input.as_mut(), &header, start, key)
            })
            .and_then(|bytes| {
                EncodedView::from_stored(&bytes)
                    .and_then(|value| value.restore())
                    .or(Err(EntryFault::Damaged))
            });
        store_fault |= entry.maintenance.is_some();
        let decoded = {
            let _closed = entry;
            decoded
        };
        if store_fault {
            self.enabled.store(false, Ordering::Release);
        }
        match decoded {
            Ok(artifact) if store_fault => ReadOutcome::HitWithStoreFault(Arc::new(artifact)),
            Ok(artifact) => ReadOutcome::Hit(Arc::new(artifact)),
            Err(fault) if store_fault => {
                let _ = self.cache.invalidate(segment, Some(token));
                ReadOutcome::RejectedWithStoreFault(fault)
            }
            Err(fault) => self.reject(segment, Some(token), fault),
        }
    }
}
