//! Nonblocking bundle operations on the shared cache coordinator.

use std::path::{Path, PathBuf};

use mokly_platform::error;
use mokly_platform::locks::FileLock;
use mokly_sidecar::bundle_store::RecordToken;

use crate::bundle_cache_types::{BundleCache, Mutation, RawRead};
use crate::cache::DiskCache;
use crate::cache_types::Kind;
use crate::error::{Error, InternalError, Result};
use crate::storage::valid_key;

impl DiskCache {
    pub(crate) fn bundle_namespace(&self, key: &str) -> Result<PathBuf> {
        self.check()?;
        if key.len() != 64 || !valid_key(key) {
            return Err(Error::UnsafeCache {
                path: self.root.join(key),
            });
        }
        self.reporter.opened(&self.root);
        let namespace = self.root.join(Kind::Bundles.directory());
        for path in [
            namespace.clone(),
            namespace.join("locks"),
            namespace.join("entries"),
            namespace.join("staging"),
            namespace.join("trash"),
        ] {
            self.storage.prepare(&path)?;
        }
        Ok(namespace)
    }

    pub(crate) fn bundle_lock(
        &self,
        path: &Path,
        shared: bool,
    ) -> Result<Option<Box<dyn FileLock>>> {
        self.check()?;
        let result = if shared {
            self.locks.try_lock_shared(path)
        } else {
            self.locks.try_lock(path)
        };
        match result {
            Ok(guard) => Ok(Some(guard)),
            Err(error::Error::Locked { .. }) => Ok(None),
            Err(source) => Err(InternalError::Platform { source }.into()),
        }
    }
}

impl BundleCache for DiskCache {
    fn read(&self, key: &str) -> Result<RawRead> {
        self.bundle_read(key)
    }

    fn replace(&self, key: &str, bytes: &[u8]) -> Result<Mutation> {
        self.bundle_replace(key, bytes)
    }

    fn invalidate(&self, key: &str, token: Option<RecordToken>) -> Result<Mutation> {
        self.bundle_invalidate(key, token)
    }

    fn cancelled(&self) -> bool {
        self.cancellation.cancelled()
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_cache_tests.rs"]
mod bundle_cache_tests;
