//! Checkout-converted source extraction into a bounded fresh directory.

use std::path::Path;

use crate::error::{Error, IoResult, Result};
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::tree::Limits;

impl GitRepository {
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
        let checkout = self.checkout(&entries, commit, limits)?;
        let mut archive = self.disk.archive(destination)?;
        let mut bytes = 0usize;
        for entry in &entries {
            let source = checkout.file(&entry.path)?;
            let size = std::fs::metadata(&source).git()?.len();
            let size = usize::try_from(size).map_err(|_| Error::ByteLimit {
                limit: limits.bytes,
            })?;
            if size > limits.bytes.saturating_sub(bytes) {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
            bytes += size;
            let Some(mut output) = archive.file(&entry.path, entry.mode.executable())? else {
                continue;
            };
            let mut input = std::fs::File::open(source).git()?;
            std::io::copy(&mut input, &mut output).git()?;
        }
        archive.finish()
    }
}
