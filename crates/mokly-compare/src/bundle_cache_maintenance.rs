//! Bounded stripe ownership and room reservation before bundle payload IO.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_platform::locks::FileLock;
use mokly_sidecar::bundle_outcomes::SkipReason;

use crate::bundle_cache_types::{BundleReceipt, CAPACITY};
use crate::cache::DiskCache;
use crate::cache_lock::entry_lock_path;
use crate::cache_types::Kind;
use crate::error::Result;

/// Each stripe is attempted once, including eviction and stale-stage cleanup.
pub(crate) struct StripeGuards {
    attempted: BTreeMap<PathBuf, bool>,
    held: Vec<Box<dyn FileLock>>,
}

impl StripeGuards {
    pub(crate) fn new(active: PathBuf) -> Self {
        Self {
            attempted: BTreeMap::from([(active, true)]),
            held: vec![],
        }
    }

    fn acquire(&mut self, cache: &DiskCache, namespace: &Path, key: &str) -> Result<bool> {
        let path = entry_lock_path(namespace, Kind::Bundles, key);
        if let Some(acquired) = self.attempted.get(&path) {
            return Ok(*acquired);
        }
        let guard = cache.bundle_lock(&path, false)?;
        let acquired = guard.is_some();
        self.attempted.insert(path, acquired);
        if let Some(guard) = guard {
            self.held.push(guard);
        }
        Ok(acquired)
    }
}

pub(crate) enum Reservation {
    Ready(BundleReceipt),
    Skipped(SkipReason),
}

impl DiskCache {
    pub(crate) fn bundle_clean_trash(&self, namespace: &Path) -> Result<bool> {
        let mut cleaned = true;
        for record in self
            .storage
            .bundle_records(&namespace.join("trash"), CAPACITY)?
        {
            self.check()?;
            if record.bytes > CAPACITY {
                cleaned = false;
            } else {
                self.storage
                    .remove(&namespace.join("trash").join(record.key))?;
            }
        }
        Ok(cleaned)
    }

    pub(crate) fn bundle_reserve(
        &self,
        namespace: &Path,
        key: &str,
        needed: u64,
        runtime_digest: [u8; 32],
    ) -> Result<Reservation> {
        let mut guards = StripeGuards::new(entry_lock_path(namespace, Kind::Bundles, key));
        for record in self
            .storage
            .bundle_records(&namespace.join("staging"), CAPACITY)?
        {
            if guards.acquire(self, namespace, &record.key)? {
                self.storage.bundle_retire(
                    &namespace.join("staging").join(record.key),
                    &namespace.join("trash"),
                )?;
            }
        }
        if !self.bundle_clean_trash(namespace)? {
            return Ok(Reservation::Skipped(SkipReason::Capacity));
        }
        let Some(used) = self.bundle_next_used(namespace)? else {
            return Ok(Reservation::Skipped(SkipReason::SequenceExhausted));
        };
        let mut entries = self
            .storage
            .bundle_records(&namespace.join("entries"), CAPACITY)?;
        if entries.iter().any(|record| record.bytes > CAPACITY) {
            return Ok(Reservation::Skipped(SkipReason::Capacity));
        }
        if entries.iter().any(|record| record.key == key) {
            self.storage.bundle_retire(
                &namespace.join("entries").join(key),
                &namespace.join("trash"),
            )?;
            if !self.bundle_clean_trash(namespace)? {
                return Ok(Reservation::Skipped(SkipReason::Capacity));
            }
            entries.retain(|record| record.key != key);
        }
        let stages = self
            .storage
            .bundle_records(&namespace.join("staging"), CAPACITY)?;
        let staged = stages.iter().fold(0u64, |total, record| {
            total.saturating_add(if record.receipt.is_some() {
                record.bytes
            } else {
                CAPACITY
            })
        });
        let mut total = entries
            .iter()
            .fold(needed.saturating_add(staged), |sum, record| {
                sum.saturating_add(record.bytes)
            });
        entries.sort_by(|left, right| {
            (
                left.receipt.as_ref().map_or(0, |receipt| receipt.used),
                &left.key,
            )
                .cmp(&(
                    right.receipt.as_ref().map_or(0, |receipt| receipt.used),
                    &right.key,
                ))
        });
        for record in entries {
            if total <= CAPACITY {
                break;
            }
            if guards.acquire(self, namespace, &record.key)? {
                self.storage.bundle_retire(
                    &namespace.join("entries").join(record.key),
                    &namespace.join("trash"),
                )?;
                if !self.bundle_clean_trash(namespace)? {
                    return Ok(Reservation::Skipped(SkipReason::Capacity));
                }
                total = total.saturating_sub(record.bytes);
            }
        }
        if total > CAPACITY {
            return Ok(Reservation::Skipped(SkipReason::Capacity));
        }
        let receipt = BundleReceipt {
            bytes: needed,
            used,
            publication: self.storage.bundle_nonce()?,
            runtime_digest,
        };
        let stage = namespace.join("staging").join(key);
        self.storage.prepare(&stage)?;
        self.storage.bundle_receipt(&stage, &receipt, true)?;
        Ok(Reservation::Ready(receipt))
    }
}
