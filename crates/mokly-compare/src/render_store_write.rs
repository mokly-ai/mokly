//! Segment publication and process-local index updates run only on the writer.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_store::StoreKey;
use mokly_model::material::digest;

use crate::bundle_cache_types::{Mutation, RawRead};
use crate::error::Error;
use crate::render_segment;
use crate::render_segment_buffer::BuiltSegment;
use crate::render_store::{CachedDocuments, SegmentIdentity, SegmentPosition, WriteOutcome};

impl CachedDocuments {
    pub(crate) fn save_segment(&self, built: &BuiltSegment<'_>) -> WriteOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return WriteOutcome::Skipped;
        }
        let bytes = built.bytes();
        let segment = digest(bytes);
        let header_digest = built.header_digest;
        let start = built.start;
        match self.cache.replace(&segment, bytes) {
            Ok(Mutation::Written) => {
                let mut fault = false;
                if let Ok(_maintenance) = self.maintenance.try_lock() {
                    fault = match self.initialize() {
                        Ok(Some(fault)) => fault,
                        Ok(None) => false,
                        Err(_) => true,
                    };
                    let publication = match self.cache.inspect(&segment) {
                        Ok(RawRead::Entry(entry)) if entry.bytes == bytes.len() as u64 => {
                            Some(entry.token)
                        }
                        Err(_) => {
                            fault = true;
                            None
                        }
                        _ => None,
                    };
                    if let (Some(index), Some(token)) = (self.index.load_full(), publication) {
                        let mut index = index.as_ref().clone();
                        let segment = Arc::new(SegmentIdentity {
                            key: segment,
                            header_digest,
                            token,
                            bytes: bytes.len() as u64,
                            start,
                        });
                        for document in built.positions.iter().flatten() {
                            let key = String::from_utf8_lossy(&document.key).into_owned();
                            if index.len() < 16_384 || index.contains_key(&StoreKey(key.clone())) {
                                index.insert(
                                    StoreKey(key),
                                    SegmentPosition {
                                        segment: segment.clone(),
                                        offset: document.offset as u64,
                                        length: document.bytes as u64,
                                        digest: render_segment::hex(&document.digest),
                                    },
                                );
                            }
                        }
                        self.index.store(Some(Arc::new(index)));
                    }
                }
                if fault {
                    self.enabled.store(false, Ordering::Release);
                    WriteOutcome::WrittenWithStoreFault(built.documents())
                } else {
                    WriteOutcome::Written(built.documents())
                }
            }
            Ok(_) | Err(Error::Cancelled | Error::CacheLimit { .. }) => WriteOutcome::Skipped,
            Err(_) => {
                self.enabled.store(false, Ordering::Release);
                WriteOutcome::Unavailable
            }
        }
    }
}
