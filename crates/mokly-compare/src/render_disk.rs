//! Render segments share common durable raw publication and repair access order once.

use std::sync::atomic::Ordering;

use mokly_sidecar::bundle_outcomes::SkipReason;
use mokly_sidecar::bundle_store::RecordToken;
use sha2::{Digest, Sha256};

use crate::bundle_cache_types::{Mutation, RawRead};
use crate::cache_types::Kind;
use crate::error::Result;
use crate::render_store::{RenderDisk, SegmentCache};

impl SegmentCache for RenderDisk {
    fn entries(&self) -> Result<Option<Vec<String>>> {
        if !self.prepare()? {
            return Ok(None);
        }
        Ok(self
            .initial
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone())
    }
    fn read(&self, key: &str) -> Result<RawRead> {
        if !self.prepare()? {
            return Ok(RawRead::Contended);
        }
        self.cache.raw_read(key, Kind::Renders, self.capacity, true)
    }
    fn inspect(&self, key: &str) -> Result<RawRead> {
        if !self.prepare()? {
            return Ok(RawRead::Contended);
        }
        self.cache
            .raw_read(key, Kind::Renders, self.capacity, false)
    }
    fn replace(&self, key: &str, bytes: &[u8]) -> Result<Mutation> {
        if !self.prepare()? {
            return Ok(Mutation::Skipped(SkipReason::Contended));
        }
        self.cache.raw_replace(
            key,
            bytes,
            Sha256::digest(bytes).into(),
            Kind::Renders,
            self.capacity,
        )
    }
    fn invalidate(&self, key: &str, token: Option<RecordToken>) -> Result<Mutation> {
        if !self.prepare()? {
            return Ok(Mutation::Skipped(SkipReason::Contended));
        }
        self.cache
            .raw_invalidate(key, token, Kind::Renders, self.capacity)
    }
}

impl RenderDisk {
    fn prepare(&self) -> Result<bool> {
        if self.ready.load(Ordering::Acquire) {
            return Ok(true);
        }
        let Ok(mut initial) = self.initial.try_lock() else {
            return Ok(false);
        };
        if self.ready.load(Ordering::Acquire) {
            return Ok(true);
        }
        let namespace = self.cache.raw_namespace(&"0".repeat(64), Kind::Renders)?;
        let Some(_state) = self
            .cache
            .bundle_lock(&namespace.join("state.lock"), false)?
        else {
            return Ok(false);
        };
        let mut records = self
            .cache
            .storage
            .bundle_records(&namespace.join("entries"), self.capacity)?;
        let floor = records
            .iter()
            .filter_map(|record| record.receipt.as_ref())
            .map(|receipt| receipt.used)
            .max()
            .unwrap_or(0);
        self.cache.storage.render_sequence(&namespace, floor)?;
        records.sort_by_key(|record| record.receipt.as_ref().map_or(0, |receipt| receipt.used));
        *initial = Some(records.into_iter().map(|record| record.key).collect());
        self.ready.store(true, Ordering::Release);
        Ok(true)
    }
}
