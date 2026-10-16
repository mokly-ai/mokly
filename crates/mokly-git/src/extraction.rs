//! Incremental source extraction streams oversized blobs under one disk bound.

use std::ffi::OsString;
use std::path::Path;

use crate::blob_batches;
use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::disk::{Archive, ArchiveFile};
use crate::error::{Error, Result};
use crate::identity::ObjectId;
use crate::repository::{GitRepository, Repository};
use crate::tree::{Entry, Limits, Mode};

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
        let mut bytes = 0usize;
        for entry in &entries {
            if entry.size > limits.bytes.saturating_sub(bytes) {
                return Err(Error::ByteLimit {
                    limit: limits.bytes,
                });
            }
            bytes += entry.size;
        }
        let mut archive = self.disk.archive(destination)?;
        let mut start = 0;
        while start < entries.len() {
            if blob_batches::cost(&entries[start]) > blob_batches::BYTES {
                self.extract_blob(&entries[start], archive.as_mut())?;
                start += 1;
                continue;
            }
            let mut end = start;
            let mut used = 0usize;
            while end < entries.len() && end - start < blob_batches::COUNT {
                let cost = blob_batches::cost(&entries[end]);
                if cost > blob_batches::BYTES - used {
                    break;
                }
                used += cost;
                end += 1;
            }
            let batch = &entries[start..end];
            let contents = self.load(batch, limits.bytes)?;
            let files = batch
                .iter()
                .zip(contents)
                .map(|(entry, bytes)| ArchiveFile {
                    path: entry.path.clone(),
                    bytes,
                    executable: entry.mode == Mode::Executable,
                })
                .collect::<Vec<_>>();
            archive.write(&files)?;
            start = end;
        }
        archive.finish()
    }

    fn extract_blob(&self, entry: &Entry, archive: &mut dyn Archive) -> Result<()> {
        let Some(mut output) = archive.file(&entry.path, entry.mode == Mode::Executable)? else {
            return Ok(());
        };
        self.runner.copy(
            &Request {
                directory: self.directory.clone(),
                args: [
                    "--no-optional-locks",
                    "cat-file",
                    "blob",
                    entry.object.as_str(),
                ]
                .into_iter()
                .map(OsString::from)
                .collect(),
                stdin: Vec::new(),
                output_limit: DEFAULT_OUTPUT_LIMIT,
                stderr_limit: DEFAULT_STDERR_LIMIT,
            },
            output.as_mut(),
            entry.size,
        )
    }
}
