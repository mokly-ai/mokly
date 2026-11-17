//! Shared stripe reads and publication-safe rejected-entry removal.

use std::path::Path;

use mokly_sidecar::bundle_outcomes::SkipReason;
use mokly_sidecar::bundle_store::RecordToken;

use crate::bundle_cache_types::{CAPACITY, Mutation, OpenBundle, RawEntry, RawRead};
use crate::cache::DiskCache;
use crate::cache_lock::entry_lock_path;
use crate::cache_types::Kind;
use crate::error::Result;

impl DiskCache {
    pub(crate) fn bundle_read(&self, key: &str) -> Result<RawRead> {
        let namespace = self.bundle_namespace(key)?;
        let Some(guard) =
            self.bundle_lock(&entry_lock_path(&namespace, Kind::Bundles, key), true)?
        else {
            return Ok(RawRead::Contended);
        };
        let target = namespace.join("entries").join(key);
        match self.storage.bundle_open(&target)? {
            OpenBundle::Complete {
                input,
                bytes,
                mut receipt,
            } => {
                let maintenance = (|| {
                    if let Some(_state) = self.bundle_lock(&namespace.join("state.lock"), false)?
                        && let Some(used) = self.bundle_next_used(&namespace)?
                    {
                        receipt.used = used;
                        self.storage.bundle_receipt(&target, &receipt, false)?;
                    }
                    Ok(())
                })()
                .err();
                Ok(RawRead::Entry(RawEntry {
                    input,
                    bytes,
                    token: receipt.publication,
                    maintenance,
                    guard,
                }))
            }
            OpenBundle::Absent => Ok(RawRead::Absent),
            OpenBundle::Damaged(token) => Ok(RawRead::Damaged(token)),
            OpenBundle::Unreadable(token) => Ok(RawRead::Unreadable(token)),
        }
    }

    pub(crate) fn bundle_next_used(&self, namespace: &Path) -> Result<Option<u64>> {
        let entries = self
            .storage
            .bundle_records(&namespace.join("entries"), CAPACITY)?;
        let stages = self
            .storage
            .bundle_records(&namespace.join("staging"), CAPACITY)?;
        Ok(entries
            .iter()
            .chain(stages.iter())
            .filter_map(|record| record.receipt.as_ref())
            .map(|receipt| receipt.used)
            .max()
            .unwrap_or(0)
            .checked_add(1))
    }

    pub(crate) fn bundle_invalidate(
        &self,
        key: &str,
        token: Option<RecordToken>,
    ) -> Result<Mutation> {
        let namespace = self.bundle_namespace(key)?;
        let Some(_entry) =
            self.bundle_lock(&entry_lock_path(&namespace, Kind::Bundles, key), false)?
        else {
            return Ok(Mutation::Skipped(SkipReason::Contended));
        };
        let Some(_state) = self.bundle_lock(&namespace.join("state.lock"), false)? else {
            return Ok(Mutation::Skipped(SkipReason::Contended));
        };
        let target = namespace.join("entries").join(key);
        let current = {
            match self.storage.bundle_open(&target)? {
                OpenBundle::Complete { receipt, .. } => Some(Some(receipt.publication)),
                OpenBundle::Damaged(current) | OpenBundle::Unreadable(current) => Some(current),
                OpenBundle::Absent => None,
            }
        };
        let Some(current) = current else {
            return Ok(Mutation::Skipped(SkipReason::Absent));
        };
        if current.is_some() && current != token {
            return Ok(Mutation::Skipped(SkipReason::Changed));
        }
        self.storage
            .bundle_retire(&target, &namespace.join("trash"))?;
        self.bundle_clean_trash(&namespace)?;
        Ok(Mutation::Invalidated)
    }
}
