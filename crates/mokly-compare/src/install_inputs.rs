//! Install records stream into a digest. Bounded package listings retain no file payloads.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

use mokly_git::control::Cancellation;
use mokly_git::tree::Limits;
use sha2::{Digest, Sha256};

use crate::base_freshness::InstallInputs;
use crate::error::{Error, InternalError, IoResult, Result};

/// Host install reader with cancellation and bounded temporary package metadata.
pub struct SystemInstallInputs {
    /// Preparing classification or Serve stop token.
    pub cancellation: Arc<dyn Cancellation>,
}

#[derive(Default)]
struct ListingBudget {
    names: usize,
    bytes: usize,
}

impl InstallInputs for SystemInstallInputs {
    fn read(&self, root: &Path) -> Result<Option<String>> {
        let mut hash = Sha256::new();
        hash.update(b"mokly-working-install-v1\0");
        let mut budget = ListingBudget::default();
        let Some(entries) = self.entries(root, &mut budget)? else {
            return Ok(None);
        };
        for (name, kind) in entries {
            frame(&mut hash, name.as_encoded_bytes());
            hash.update([kind]);
            if name.as_encoded_bytes().starts_with(b"@") && kind == 1 {
                let Some(packages) = self.entries(&root.join(&name), &mut budget)? else {
                    return Ok(None);
                };
                hash.update((packages.len() as u64).to_le_bytes());
                for (name, kind) in packages {
                    frame(&mut hash, name.as_encoded_bytes());
                    hash.update([kind]);
                }
            }
        }
        for record in [
            root.join(".package-lock.json"),
            root.join(".modules.yaml"),
            root.join(".pnpm/lock.yaml"),
            root.join(".yarn-integrity"),
            root.join(".yarn-state.yml"),
            root.parent().unwrap_or(root).join(".yarn/install-state.gz"),
        ] {
            if !self.record(&record, &mut hash)? {
                return Ok(None);
            }
        }
        Ok(Some(
            hash.finalize()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
        ))
    }
}

impl SystemInstallInputs {
    fn check_cancelled(&self) -> Result<()> {
        if self.cancellation.cancelled() {
            return Err(Error::Cancelled);
        }
        Ok(())
    }

    fn entries(
        &self,
        root: &Path,
        budget: &mut ListingBudget,
    ) -> Result<Option<BTreeMap<OsString, u8>>> {
        self.check_cancelled()?;
        let entries = match fs::read_dir(root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Some(BTreeMap::new()));
            }
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        let mut names = BTreeMap::new();
        for entry in entries {
            self.check_cancelled()?;
            let entry = entry.base()?;
            let name = entry.file_name();
            budget.bytes = budget.bytes.saturating_add(name.as_encoded_bytes().len());
            budget.names = budget.names.saturating_add(1);
            if budget.names > Limits::default().files || budget.bytes > Limits::default().bytes {
                return Ok(None);
            }
            let kind = entry.file_type().base()?;
            names.insert(
                name,
                if kind.is_dir() {
                    1
                } else if kind.is_file() {
                    2
                } else {
                    3
                },
            );
        }
        Ok(Some(names))
    }

    fn record(&self, path: &Path, hash: &mut Sha256) -> Result<bool> {
        self.check_cancelled()?;
        let metadata = match fs::symlink_metadata(path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                hash.update([0]);
                return Ok(true);
            }
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if !metadata.is_file() || metadata.len() > Limits::default().bytes as u64 {
            return Ok(false);
        }
        hash.update([1]);
        hash.update(metadata.len().to_le_bytes());
        let mut file = fs::File::open(path)
            .base()?
            .take(Limits::default().bytes as u64 + 1);
        let mut buffer = [0u8; 32 * 1024];
        let mut bytes = 0usize;
        loop {
            self.check_cancelled()?;
            let count = file.read(&mut buffer).base()?;
            if count == 0 {
                break;
            }
            bytes = bytes.saturating_add(count);
            if bytes > Limits::default().bytes {
                return Ok(false);
            }
            hash.update(&buffer[..count]);
        }
        Ok(bytes as u64 == metadata.len())
    }
}

fn frame(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_le_bytes());
    hash.update(bytes);
}
