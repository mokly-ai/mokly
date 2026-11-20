//! Shared stripe reads and publication-safe rejected-entry removal.

use std::path::Path;

use mokly_sidecar::bundle_outcomes::SkipReason;
use mokly_sidecar::bundle_store::RecordToken;

use crate::bundle_cache_types::{
    CAPACITY, CompilationRead, Mutation, OpenBundle, RawEntry, RawRead,
};
use crate::cache::DiskCache;
use crate::cache_lock::entry_lock_path;
use crate::cache_types::Kind;
use crate::error::Result;

impl DiskCache {
    pub(crate) fn bundle_compilation(&self, key: &str) -> Result<CompilationRead> {
        let namespace = self.bundle_namespace(key)?;
        let Some(_entry) =
            self.bundle_lock(&entry_lock_path(&namespace, Kind::Bundles, key), true)?
        else {
            return Ok(CompilationRead::Contended);
        };
        self.storage
            .bundle_compilation(&namespace.join("entries").join(key))
    }
    pub(crate) fn bundle_read(&self, key: &str) -> Result<RawRead> {
        self.raw_read(key, Kind::Bundles, CAPACITY, true)
    }

    pub(crate) fn raw_read(
        &self,
        key: &str,
        kind: Kind,
        capacity: u64,
        touch: bool,
    ) -> Result<RawRead> {
        let namespace = self.raw_namespace(key, kind)?;
        let Some(guard) = self.bundle_lock(&entry_lock_path(&namespace, kind, key), true)? else {
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
                    if !touch {
                        return Ok(());
                    }
                    if let Some(_state) = self.bundle_lock(&namespace.join("state.lock"), false)?
                        && let Some(used) = self.raw_next_used(&namespace, kind, capacity)?
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
                    runtime_digest: receipt.runtime_digest,
                    maintenance,
                    guard,
                }))
            }
            OpenBundle::Absent => Ok(RawRead::Absent),
            OpenBundle::Damaged(token) => Ok(RawRead::Damaged(token)),
            OpenBundle::Unreadable(token) => Ok(RawRead::Unreadable(token)),
        }
    }

    pub(crate) fn raw_next_used(
        &self,
        namespace: &Path,
        kind: Kind,
        capacity: u64,
    ) -> Result<Option<u64>> {
        if kind == Kind::Renders {
            return self.storage.render_sequence(namespace, 0);
        }
        let entries = self
            .storage
            .bundle_records(&namespace.join("entries"), capacity)?;
        let stages = self
            .storage
            .bundle_records(&namespace.join("staging"), capacity)?;
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
        self.raw_invalidate(key, token, Kind::Bundles, CAPACITY)
    }

    pub(crate) fn raw_invalidate(
        &self,
        key: &str,
        token: Option<RecordToken>,
        kind: Kind,
        capacity: u64,
    ) -> Result<Mutation> {
        let namespace = self.raw_namespace(key, kind)?;
        let Some(_entry) = self.bundle_lock(&entry_lock_path(&namespace, kind, key), false)? else {
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
        self.raw_clean_trash(&namespace, capacity)?;
        Ok(Mutation::Invalidated)
    }
}
