//! Locked byte-bounded caches with deterministic least-recently-used eviction.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{Cancellation, Clock};
use mokly_platform::error;
use mokly_platform::locks::{FileLock, Locks};

use crate::cache_types::{Builder, Cache, Kind, Lease, Receipt, Record, Reporter, Storage};
use crate::error::{Error, InternalError, Result};
use crate::storage::valid_key;

/// Persistent cache coordinator. Construct it once with a shared reporter.
pub struct DiskCache {
    /// External repository-specific cache directory.
    pub root: PathBuf,
    /// Extraction namespace byte bound.
    pub source_bytes: u64,
    /// Dependency namespace byte bound.
    pub dependency_bytes: u64,
    /// Filesystem adapter.
    pub storage: Arc<dyn Storage>,
    /// OS-backed exclusive lock adapter.
    pub locks: Arc<dyn Locks>,
    /// Polling clock for concurrent processes.
    pub clock: Arc<dyn Clock>,
    /// Command cancellation.
    pub cancellation: Arc<dyn Cancellation>,
    /// Process-scoped cache announcement.
    pub reporter: Arc<dyn Reporter>,
}

impl DiskCache {
    fn lock(&self, path: &Path) -> Result<Box<dyn FileLock>> {
        loop {
            if self.cancellation.cancelled() {
                return Err(Error::Cancelled);
            }
            match self.locks.try_lock(path) {
                Ok(guard) => return Ok(guard),
                Err(error::Error::Locked { .. }) => self.clock.pause(Duration::from_millis(5)),
                Err(source) => return Err(InternalError::Platform { source }.into()),
            }
        }
    }

    fn evict(
        &self,
        namespace: &Path,
        records: &[Record],
        key: &str,
        needed: u64,
        limit: u64,
    ) -> Result<()> {
        let mut total = records
            .iter()
            .filter(|record| record.key != key)
            .fold(needed, |sum, record| {
                sum.saturating_add(record.receipt.bytes)
            });
        let mut ordered = records
            .iter()
            .filter(|record| record.key != key)
            .collect::<Vec<_>>();
        ordered.sort_by(|left, right| {
            (left.receipt.used, &left.key).cmp(&(right.receipt.used, &right.key))
        });
        for record in ordered {
            if total <= limit {
                return Ok(());
            }
            let path = namespace.join("locks").join(format!("{}.lock", record.key));
            match self.locks.try_lock(&path) {
                Ok(_guard) => {
                    self.storage
                        .remove(&namespace.join("entries").join(&record.key))?;
                    total = total.saturating_sub(record.receipt.bytes);
                }
                Err(error::Error::Locked { .. }) => {}
                Err(source) => return Err(InternalError::Platform { source }.into()),
            }
        }
        if total > limit {
            return Err(Error::CacheLimit { limit });
        }
        Ok(())
    }
}

impl Cache for DiskCache {
    fn get(&self, kind: Kind, key: &str, builder: &dyn Builder) -> Result<Lease> {
        if !valid_key(key) {
            return Err(Error::UnsafeCache {
                path: self.root.join(key),
            });
        }
        let namespace = self.root.join(kind.directory());
        for path in [
            &namespace,
            &namespace.join("locks"),
            &namespace.join("entries"),
            &namespace.join("staging"),
        ] {
            self.storage.prepare(path)?;
        }
        self.reporter.opened(&self.root);
        let guard = self.lock(&namespace.join("locks").join(format!("{key}.lock")))?;
        let _namespace = self.lock(&namespace.join("state.lock"))?;
        self.storage.clear_staging(&namespace.join("staging"))?;
        let records = self.storage.records(&namespace.join("entries"))?;
        let used = records
            .iter()
            .map(|record| record.receipt.used)
            .max()
            .unwrap_or(0)
            .saturating_add(1);
        let limit = match kind {
            Kind::Sources => self.source_bytes,
            Kind::Dependencies => self.dependency_bytes,
        };
        let target = namespace.join("entries").join(key);
        if records
            .iter()
            .any(|record| record.key == key && record.receipt.used > 0)
        {
            match self.storage.size(&target.join("data"), limit) {
                Ok(bytes) if bytes.saturating_add(1024) <= limit => {
                    let digest = self.storage.digest(&target.join("data"), limit)?;
                    if !records
                        .iter()
                        .any(|record| record.key == key && record.receipt.digest == digest)
                    {
                        self.storage.remove(&target)?;
                    } else {
                        let receipt = Receipt {
                            bytes: bytes.saturating_add(1024),
                            used,
                            digest,
                        };
                        if self.cancellation.cancelled() {
                            return Err(Error::Cancelled);
                        }
                        self.evict(&namespace, &records, key, receipt.bytes, limit)?;
                        self.storage.receipt(&target, &receipt)?;
                        return Ok(Lease {
                            directory: target.join("data"),
                            guard,
                        });
                    }
                }
                Err(Error::Cancelled) => return Err(Error::Cancelled),
                _ => self.storage.remove(&target)?,
            }
        }
        self.storage.remove(&target)?;
        let stage = match kind {
            Kind::Sources => namespace.join("staging").join(key),
            Kind::Dependencies => target.clone(),
        };
        self.storage.remove(&stage)?;
        self.storage.prepare(&stage)?;
        let result = (|| {
            builder.build(&stage.join("data"))?;
            if self.cancellation.cancelled() {
                return Err(Error::Cancelled);
            }
            let bytes = self
                .storage
                .size(&stage.join("data"), limit)?
                .saturating_add(1024);
            if bytes > limit {
                return Err(Error::CacheLimit { limit });
            }
            let digest = self.storage.digest(&stage.join("data"), limit)?;
            if self.cancellation.cancelled() {
                return Err(Error::Cancelled);
            }
            self.evict(&namespace, &records, key, bytes, limit)?;
            self.storage.receipt(
                &stage,
                &Receipt {
                    bytes,
                    used,
                    digest,
                },
            )?;
            if kind == Kind::Sources {
                self.storage.publish(&stage, &target)?;
            }
            Ok(Lease {
                directory: target.join("data"),
                guard,
            })
        })();
        if result.is_err() {
            let _ = self.storage.remove(&stage);
        }
        result
    }
}

#[cfg(test)]
#[path = "_tests_/cache_tests.rs"]
mod cache_tests;
