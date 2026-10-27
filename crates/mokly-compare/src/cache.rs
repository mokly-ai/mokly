//! Shared cache leases and exclusive builds without namespace-long IO.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{Cancellation, Clock};
use mokly_platform::error;
use mokly_platform::locks::{FileLock, Locks};

use crate::cache_types::{Builder, Cache, Kind, Lease, Receipt, Reporter, Storage};
use crate::error::{Error, InternalError, Result};
use crate::storage::valid_key;

/// Persistent cache coordinator with separate data and lease ownership.
pub struct DiskCache {
    /// Canonical namespace root, resolved once at composition.
    pub root: PathBuf,
    /// Retained extraction bytes.
    pub source_bytes: u64,
    /// Retained dependency bytes.
    pub dependency_bytes: u64,
    /// Cache filesystem operations.
    pub storage: Arc<dyn Storage>,
    /// Shared leases and exclusive writers.
    pub locks: Arc<dyn Locks>,
    /// Polling clock.
    pub clock: Arc<dyn Clock>,
    /// Generation cancellation.
    pub cancellation: Arc<dyn Cancellation>,
    /// Shared process announcement.
    pub reporter: Arc<dyn Reporter>,
}

impl DiskCache {
    pub(crate) fn lock(&self, path: &Path, shared: bool) -> Result<Box<dyn FileLock>> {
        loop {
            self.check()?;
            let result = if shared {
                self.locks.try_lock_shared(path)
            } else {
                self.locks.try_lock(path)
            };
            match result {
                Ok(guard) => return Ok(guard),
                Err(error::Error::Locked { .. }) => self.clock.pause(Duration::from_millis(5)),
                Err(source) => return Err(InternalError::Platform { source }.into()),
            }
        }
    }

    pub(crate) fn check(&self) -> Result<()> {
        if self.cancellation.cancelled() {
            Err(Error::Cancelled)
        } else {
            Ok(())
        }
    }

    fn hit(&self, namespace: &Path, key: &str, limit: u64) -> Result<Option<Lease>> {
        let guard = self.lock(&namespace.join("locks").join(format!("{key}.lock")), true)?;
        let target = namespace.join("entries").join(key);
        let Some(mut receipt) = self.storage.inspect(&target, limit)? else {
            return Ok(None);
        };
        {
            let _namespace = self.lock(&namespace.join("state.lock"), false)?;
            let records = self.storage.records(&namespace.join("entries"))?;
            self.evict(namespace, &records, key, receipt.bytes, limit)?;
            receipt.used = records
                .iter()
                .map(|record| record.receipt.used)
                .max()
                .unwrap_or(0)
                .saturating_add(1);
            self.check()?;
            self.storage.touch(&target, &receipt)?;
        }
        self.clean_trash(namespace)?;
        Ok(Some(Lease {
            directory: target.join("data"),
            guard,
        }))
    }

    /// Builds a missing entry under its exclusive entry lock. `None` tells the
    /// caller to retry the hit, which then leases the completed entry. Sources
    /// build in `staging/` and publish by rename. Dependency installs build at
    /// their final locked location, so the local links that the install writes
    /// stay valid.
    fn build(
        &self,
        namespace: &Path,
        kind: Kind,
        key: &str,
        builder: &dyn Builder,
    ) -> Result<Option<Lease>> {
        let limit = self.capacity(kind);
        self.check()?;
        let _entry = match self
            .locks
            .try_lock(&namespace.join("locks").join(format!("{key}.lock")))
        {
            Ok(guard) => guard,
            Err(error::Error::Locked { .. }) => {
                self.clock.pause(Duration::from_millis(5));
                return Ok(None);
            }
            Err(source) => return Err(InternalError::Platform { source }.into()),
        };
        let target = namespace.join("entries").join(key);
        if self.storage.inspect(&target, limit)?.is_some() {
            return Ok(None);
        }
        {
            let _namespace = self.lock(&namespace.join("state.lock"), false)?;
            self.clean_stages(namespace, key)?;
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
            self.check()?;
            let bytes = self
                .storage
                .size(&stage.join("data"), limit)?
                .saturating_add(1024);
            if bytes > limit {
                return Err(Error::CacheLimit { limit });
            }
            if !builder.reusable() {
                return Ok(Some(self.transient(namespace, key, &stage)?));
            }
            self.storage.synchronize(&stage.join("data"))?;
            let _namespace = self.lock(&namespace.join("state.lock"), false)?;
            let records = self.storage.records(&namespace.join("entries"))?;
            self.evict(namespace, &records, key, bytes, limit)?;
            let used = records
                .iter()
                .map(|record| record.receipt.used)
                .max()
                .unwrap_or(0)
                .saturating_add(1);
            self.check()?;
            self.storage.receipt(&stage, &Receipt { bytes, used })?;
            if kind == Kind::Sources {
                self.storage.publish(&stage, &target)?;
            }
            Ok(None)
        })();
        if result.is_err() {
            let _ = self.storage.remove(&stage);
        }
        result
    }
}

impl Cache for DiskCache {
    fn capacity(&self, kind: Kind) -> u64 {
        match kind {
            Kind::Sources => self.source_bytes,
            Kind::Dependencies => self.dependency_bytes,
        }
    }

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
        loop {
            self.clean_trash(&namespace)?;
            if let Some(lease) = self.hit(&namespace, key, self.capacity(kind))? {
                return Ok(lease);
            }
            if let Some(lease) = self.build(&namespace, kind, key, builder)? {
                return Ok(lease);
            }
        }
    }
}

#[cfg(test)]
#[path = "_tests_/cache_tests.rs"]
mod cache_tests;
