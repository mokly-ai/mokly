//! Segment publication and process-local index updates run only on the writer.

use std::io::Cursor;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_store::{StoreKey, StoredDocument};
use mokly_model::material::digest;

use crate::bundle_cache_types::{Mutation, RawRead};
use crate::error::Error;
use crate::render_segment;
use crate::render_store::{CachedDocuments, SegmentIdentity, SegmentPosition, WriteOutcome};

impl CachedDocuments {
    pub(crate) fn save_documents(&self, documents: &[StoredDocument]) -> WriteOutcome {
        if !self.enabled.load(Ordering::Acquire) {
            return WriteOutcome::Skipped;
        }
        let Some(bytes) = render_segment::encode(documents, &self.version) else {
            return WriteOutcome::Skipped;
        };
        let segment = digest(&bytes);
        let (header, start, header_digest) = match render_segment::header(
            &mut Cursor::new(&bytes),
            bytes.len() as u64,
            &self.version,
            false,
        ) {
            Ok(value) => value,
            Err(_) => return WriteOutcome::Skipped,
        };
        match self.cache.replace(&segment, &bytes) {
            Ok(Mutation::Written) => {
                let mut fault = false;
                if let Ok(mut index) = self.index.try_lock() {
                    fault = match self.initialize(&mut index) {
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
                    if let (Some(index), Some(token)) = (index.as_mut(), publication) {
                        let segment = Arc::new(SegmentIdentity {
                            key: segment,
                            header_digest,
                            token,
                            bytes: bytes.len() as u64,
                            start,
                        });
                        for document in header.documents {
                            if index.len() < 16_384
                                || index.contains_key(&StoreKey(document.key.clone()))
                            {
                                index.insert(
                                    StoreKey(document.key),
                                    SegmentPosition {
                                        segment: segment.clone(),
                                        offset: document.offset,
                                        length: document.bytes,
                                        digest: document.digest,
                                    },
                                );
                            }
                        }
                    }
                }
                if fault {
                    self.enabled.store(false, Ordering::Release);
                    WriteOutcome::WrittenWithStoreFault(documents.len())
                } else {
                    WriteOutcome::Written(documents.len())
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
