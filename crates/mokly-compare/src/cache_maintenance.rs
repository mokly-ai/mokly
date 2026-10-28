//! Nonblocking eviction and cleanup of unlocked staging entries only.
//!
//! Eviction and stage cleanup run under the short namespace lock, so they only
//! rename each victim into `trash/`. The recursive delete of the trash runs
//! later outside that lock, with cancellation checks, and the next cache open
//! sweeps any trash that an interrupted process left.

use std::path::Path;

use mokly_platform::error;

use crate::cache::DiskCache;
use crate::cache_types::Record;
use crate::error::{Error, InternalError, Result};

impl DiskCache {
    pub(crate) fn evict(
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
            self.check()?;
            let path = namespace.join("locks").join(format!("{}.lock", record.key));
            match self.locks.try_lock(&path) {
                Ok(_guard) => {
                    self.storage.retire(
                        &namespace.join("entries").join(&record.key),
                        &namespace.join("trash"),
                    )?;
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

    pub(crate) fn clean_trash(&self, namespace: &Path) -> Result<()> {
        let trash = namespace.join("trash");
        for key in self.storage.stages(&trash)? {
            self.check()?;
            self.storage.remove(&trash.join(key))?;
        }
        Ok(())
    }

    pub(crate) fn clean_stages(&self, namespace: &Path, active: &str) -> Result<()> {
        let incomplete = self.storage.records(&namespace.join("entries"))?;
        for record in incomplete
            .iter()
            .filter(|record| record.receipt.used == 0 && record.key != active)
        {
            self.check()?;
            match self
                .locks
                .try_lock(&namespace.join("locks").join(format!("{}.lock", record.key)))
            {
                Ok(_guard) => self.storage.retire(
                    &namespace.join("entries").join(&record.key),
                    &namespace.join("trash"),
                )?,
                Err(error::Error::Locked { .. }) => {}
                Err(source) => return Err(InternalError::Platform { source }.into()),
            }
        }
        for key in self.storage.stages(&namespace.join("staging"))? {
            if key == active {
                continue;
            }
            self.check()?;
            match self
                .locks
                .try_lock(&namespace.join("locks").join(format!("{key}.lock")))
            {
                Ok(_guard) => self.storage.retire(
                    &namespace.join("staging").join(key),
                    &namespace.join("trash"),
                )?,
                Err(error::Error::Locked { .. }) => {}
                Err(source) => return Err(InternalError::Platform { source }.into()),
            }
        }
        Ok(())
    }
}
