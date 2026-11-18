//! Reservation, durable staging, and atomic nonblocking bundle replacement.

use mokly_sidecar::bundle_outcomes::SkipReason;

use crate::bundle_cache_maintenance::Reservation;
use crate::bundle_cache_types::{CAPACITY, Mutation, RECEIPT_BYTES};
use crate::bundle_storage::data_path;
use crate::cache::DiskCache;
use crate::cache_lock::entry_lock_path;
use crate::cache_types::Kind;
use crate::error::Result;

impl DiskCache {
    pub(crate) fn bundle_replace(
        &self,
        key: &str,
        bytes: &[u8],
        runtime_digest: [u8; 32],
    ) -> Result<Mutation> {
        self.check()?;
        let needed = (bytes.len() as u64).saturating_add(RECEIPT_BYTES);
        if needed > CAPACITY {
            return Ok(Mutation::Skipped(SkipReason::Capacity));
        }
        let namespace = self.bundle_namespace(key)?;
        let Some(_entry) =
            self.bundle_lock(&entry_lock_path(&namespace, Kind::Bundles, key), false)?
        else {
            return Ok(Mutation::Skipped(SkipReason::Contended));
        };
        let mut receipt = {
            let Some(_state) = self.bundle_lock(&namespace.join("state.lock"), false)? else {
                return Ok(Mutation::Skipped(SkipReason::Contended));
            };
            match self.bundle_reserve(&namespace, key, needed, runtime_digest)? {
                Reservation::Ready(receipt) => receipt,
                Reservation::Skipped(reason) => return Ok(Mutation::Skipped(reason)),
            }
        };
        let stage = namespace.join("staging").join(key);
        let result = (|| {
            self.storage.prepare(&stage.join("data"))?;
            self.storage.write(&data_path(&stage), bytes)?;
            self.storage.synchronize(&stage.join("data"))?;
            let Some(_state) = self.bundle_lock(&namespace.join("state.lock"), false)? else {
                return Ok(Mutation::Skipped(SkipReason::Contended));
            };
            let Some(used) = self.bundle_next_used(&namespace)? else {
                return Ok(Mutation::Skipped(SkipReason::SequenceExhausted));
            };
            receipt.used = used;
            self.storage.bundle_receipt(&stage, &receipt, true)?;
            self.check()?;
            self.storage
                .publish(&stage, &namespace.join("entries").join(key))?;
            Ok(Mutation::Written)
        })();
        if !matches!(result, Ok(Mutation::Written)) {
            self.storage.remove(&stage)?;
        }
        result
    }
}
