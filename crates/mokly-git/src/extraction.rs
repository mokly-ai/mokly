//! Bounded checkout batches preserve independent sources when a filter fails.

use std::fs;
use std::io::{Read, Write};

use crate::command::Runner;
use std::path::Path;

use crate::checkout::Checkout;
use crate::disk::Archive;
use crate::error::{Error, IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::tree::{Entry, Limits};

impl GitRepository {
    /// Extracts the commit's regular files in batches of at most 4,096 files and
    /// 48 MiB; a larger file forms its own batch and streams to disk. Listing
    /// the tree first fetches every missing object in one request. Each batch is
    /// converted, copied into the archive, and released before the next is read,
    /// so memory does not grow with the repository.
    pub(crate) fn extract_sources(
        &self,
        commit: &ObjectId,
        destination: &Path,
        limits: Limits,
    ) -> Result<()> {
        let entries: Vec<_> = self
            .list(commit, None, limits)?
            .into_iter()
            .filter(|entry| entry.mode.regular())
            .collect();
        let raw_bytes = entries
            .iter()
            .fold(0usize, |total, entry| total.saturating_add(entry.size));
        if raw_bytes > limits.bytes {
            return Err(Error::ByteLimit {
                limit: limits.bytes,
            });
        }
        let mut archive = self.disk.archive(destination)?;
        let mut bytes = 0;
        let mut start = 0;
        while start < entries.len() {
            let mut end = start + 1;
            let mut estimate = entries[start].size;
            while end < entries.len()
                && end - start < 4096
                && estimate.saturating_add(entries[end].size) <= 48 * 1024 * 1024
            {
                estimate = estimate.saturating_add(entries[end].size);
                end += 1;
            }
            let batch = &entries[start..end];
            let remaining = limits;
            match self.checkout(batch, commit, remaining) {
                Ok(checkout) => copy_batch(
                    &checkout,
                    batch,
                    archive.as_mut(),
                    &mut bytes,
                    limits.bytes,
                    self.runner.as_ref(),
                )?,
                Err(Error::Conversion { .. }) => {
                    for entry in batch {
                        let one = std::slice::from_ref(entry);
                        match self.checkout(one, commit, limits) {
                            Ok(checkout) => copy_batch(
                                &checkout,
                                one,
                                archive.as_mut(),
                                &mut bytes,
                                limits.bytes,
                                self.runner.as_ref(),
                            )?,
                            Err(error @ Error::Conversion { .. }) => {
                                self.unavailable
                                    .lock()
                                    .unwrap_or_else(|error| error.into_inner())
                                    .insert(
                                        entry.path.to_string(),
                                        format!(
                                            "base resource {} is unavailable: {error}",
                                            entry.path
                                        ),
                                    );
                            }
                            Err(error) => return Err(error),
                        }
                    }
                }
                Err(error) => return Err(error),
            }
            start = end;
        }
        self.runner.checkpoint()?;
        archive.finish()
    }
}

fn copy_batch(
    checkout: &Checkout,
    entries: &[Entry],
    archive: &mut dyn Archive,
    total: &mut usize,
    limit: usize,
    runner: &dyn Runner,
) -> Result<()> {
    for entry in entries {
        let source = checkout.file(&entry.path)?;
        let size = fs::metadata(&source).git()?.len();
        if size > limit.saturating_sub(*total) as u64 {
            return Err(Error::ByteLimit { limit });
        }
        *total += size as usize;
        let Some(mut output) = archive.file(&entry.path, entry.mode.executable())? else {
            continue;
        };
        let mut input = fs::File::open(source).git()?;
        let mut buffer = [0; 64 * 1024];
        loop {
            runner.checkpoint()?;
            let count = input.read(&mut buffer).git()?;
            if count == 0 {
                break;
            }
            output.write_all(&buffer[..count]).git()?;
        }
    }
    Ok(())
}
