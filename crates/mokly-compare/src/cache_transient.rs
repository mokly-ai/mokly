//! Partial source leases use separate staging keys so later preparations can retry.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::locks::FileLock;
use sha2::{Digest, Sha256};

use crate::cache::DiskCache;
use crate::cache_types::{Lease, Storage};
use crate::error::{InternalError, Result};

impl DiskCache {
    pub(crate) fn transient(&self, namespace: &Path, key: &str, stage: &Path) -> Result<Lease> {
        let _namespace = self.lock(&namespace.join("state.lock"), false)?;
        let mut sequence = 0u64;
        loop {
            self.check()?;
            let mut hash = Sha256::new();
            hash.update(b"mokly-partial-source\0");
            hash.update(key.as_bytes());
            hash.update(sequence.to_le_bytes());
            let private = hash
                .finalize()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>();
            sequence = sequence.wrapping_add(1);
            let guard = match self
                .locks
                .try_lock(&namespace.join("locks").join(format!("{private}.lock")))
            {
                Ok(guard) => guard,
                Err(error::Error::Locked { .. }) => continue,
                Err(source) => return Err(InternalError::Platform { source }.into()),
            };
            let target = namespace.join("staging").join(private);
            if self.storage.directory(&target)? {
                continue;
            }
            self.storage.publish(stage, &target)?;
            return Ok(Lease {
                directory: target.join("data"),
                guard: Box::new(Transient {
                    storage: self.storage.clone(),
                    stage: target,
                    _entry: guard,
                }),
            });
        }
    }
}

struct Transient {
    storage: Arc<dyn Storage>,
    stage: PathBuf,
    _entry: Box<dyn FileLock>,
}

impl FileLock for Transient {}

impl Drop for Transient {
    fn drop(&mut self) {
        let _ = self.storage.remove(&self.stage);
    }
}
