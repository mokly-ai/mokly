//! One bounded segment inventory and optional-store failure handling.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};
use mokly_sidecar::bundle_store::RecordToken;

use crate::bundle_cache_types::{RawEntry, RawRead};
use crate::error::{Error, Result};
use crate::render_segment;
use crate::render_store::{CachedDocuments, SegmentIdentity, SegmentPosition};

impl CachedDocuments {
    pub(crate) fn failed(&self, error: Error) -> ReadOutcome {
        if matches!(error, Error::Cancelled) {
            return ReadOutcome::Miss;
        }
        if !self.enabled.swap(false, Ordering::AcqRel) {
            return ReadOutcome::Miss;
        }
        self.faults
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .pop_front()
            .map_or(
                ReadOutcome::Unavailable,
                ReadOutcome::RejectedWithStoreFault,
            )
    }

    pub(crate) fn reject(
        &self,
        segment: &str,
        token: Option<RecordToken>,
        fault: EntryFault,
    ) -> ReadOutcome {
        match self.cache.invalidate(segment, token) {
            Err(Error::Cancelled) => ReadOutcome::Miss,
            Err(_) => {
                self.enabled.store(false, Ordering::Release);
                ReadOutcome::RejectedWithStoreFault(fault)
            }
            Ok(_) => ReadOutcome::Rejected(fault),
        }
    }

    pub(crate) fn opened(&self, segment: &str, inspect: bool) -> Result<Option<RawEntry>> {
        let (token, fault) = match if inspect {
            self.cache.inspect(segment)?
        } else {
            self.cache.read(segment)?
        } {
            RawRead::Entry(entry) => return Ok(Some(entry)),
            RawRead::Absent | RawRead::Contended => return Ok(None),
            RawRead::Damaged(token) => (token, EntryFault::Damaged),
            RawRead::Unreadable(token) => (token, EntryFault::Unreadable),
        };
        self.faults
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .push_back(fault);
        self.cache.invalidate(segment, token)?;
        Ok(None)
    }

    pub(crate) fn initialize(
        &self,
        index: &mut Option<BTreeMap<StoreKey, SegmentPosition>>,
    ) -> Result<Option<bool>> {
        if index.is_some() {
            return Ok(Some(false));
        }
        let Some(segments) = self.cache.entries()? else {
            return Ok(None);
        };
        let mut entries = BTreeMap::new();
        let mut store_fault = false;
        for segment in segments.into_iter().rev() {
            let Some(mut entry) = self.opened(&segment, true)? else {
                continue;
            };
            let token = entry.token;
            let bytes = entry.bytes;
            let decoded =
                render_segment::header(entry.input.as_mut(), entry.bytes, &self.version, true);
            let maintenance = entry.maintenance.take();
            let decoded = {
                let _closed = entry;
                decoded
            };
            if let Some(error) = maintenance {
                if matches!(error, Error::Cancelled) {
                    return Err(error);
                }
                store_fault = true;
            }
            match decoded {
                Ok((header, start, header_digest)) => {
                    let segment = Arc::new(SegmentIdentity {
                        key: segment,
                        header_digest,
                        token,
                        bytes,
                        start,
                    });
                    for document in header.documents {
                        if entries.len() < 16_384 {
                            entries.entry(StoreKey(document.key)).or_insert_with(|| {
                                SegmentPosition {
                                    segment: segment.clone(),
                                    offset: document.offset,
                                    length: document.bytes,
                                    digest: document.digest,
                                }
                            });
                        }
                    }
                }
                Err(fault) => {
                    self.faults
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .push_back(fault);
                    self.cache.invalidate(&segment, Some(token))?;
                }
            }
        }
        *index = Some(entries);
        Ok(Some(store_fault))
    }
}
