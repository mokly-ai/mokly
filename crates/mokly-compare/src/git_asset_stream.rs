//! Bounded Git delivery bridges the runner thread to a caller-owned writer.

use std::io::{self, Cursor, Write};
use std::path::Path;
use std::sync::{Arc, mpsc};
use std::thread;

use mokly_git::error;
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::stream::{OpenedSource, SourceStream};
use sha2::{Digest, Sha256};

use crate::error::{Error, InternalError};
use crate::git_tree::{GitTree, adapter, failure};
use crate::sources::Sources;

const COPY_BYTES: usize = 64 * 1024;
/// Each opaque asset retains its own conversion bound.
pub(crate) const OPAQUE_LIMIT: usize = 64 * 1024 * 1024;

impl GitTree {
    pub(crate) fn opaque_stream(&self, path: &Path) -> Result<Box<dyn SourceStream>> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("open stream", path, io::ErrorKind::IsADirectory));
        };
        if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
            return Err(self.failed("open stream", path, source));
        }
        let index = self.index(path)?;
        let Some(entry) = index.entries.get(&relative) else {
            return Err(failure("open stream", path, io::ErrorKind::NotFound));
        };
        if !entry.mode.regular() {
            return Err(SourceError::Changed { path: path.into() });
        }
        let record = self.digest_record(path)?;
        let Some(length) = record.length else {
            let mut blobs = match self
                .sources
                .read_many(std::slice::from_ref(&relative), Limits::default())
            {
                Ok(blobs) => blobs,
                Err(source) => return Err(self.failed("open stream", path, source)),
            };
            let bytes = blobs
                .pop()
                .ok_or_else(|| failure("open stream", path, io::ErrorKind::UnexpectedEof))?;
            return Ok(Box::new(OpenedSource {
                length: bytes.len() as u64,
                reader: Box::new(Cursor::new(bytes)),
            }));
        };
        Ok(Box::new(GitStream {
            sources: self.sources.clone(),
            relative,
            length,
        }))
    }
}

struct GitStream {
    sources: Arc<dyn Sources>,
    relative: RepoPath,
    length: usize,
}

impl SourceStream for GitStream {
    fn length(&self) -> u64 {
        self.length as u64
    }

    fn copy_verified(&mut self, path: &Path, expected: &str, output: &mut dyn Write) -> Result<()> {
        let (sender, receiver) = mpsc::sync_channel(1);
        let sources = self.sources.clone();
        let relative = self.relative.clone();
        let handle = thread::spawn(move || {
            sources.stream(&relative, &mut ChannelWriter { sender }, OPAQUE_LIMIT)
        });
        let mut hash = Sha256::new();
        let mut length = 0usize;
        let mut copy_error = None;
        for bytes in receiver {
            length = length.saturating_add(bytes.len());
            if length > self.length {
                copy_error = Some(SourceError::Changed { path: path.into() });
                break;
            }
            if let Err(source) = output.write_all(&bytes) {
                copy_error = Some(SourceError::Io {
                    operation: "write resource",
                    path: path.into(),
                    source,
                });
                break;
            }
            hash.update(&bytes);
        }
        let copied = match handle.join() {
            Ok(result) => result,
            Err(_) => Err(Error::Internal(InternalError::Worker)),
        };
        if let Some(error) = copy_error {
            return Err(error);
        }
        let copied = match copied {
            Ok(copied) => copied,
            Err(Error::Cancelled) => return Err(SourceError::Cancelled { path: path.into() }),
            Err(source) if exceeds_blob_bound(&source) => {
                return Err(SourceError::Changed { path: path.into() });
            }
            Err(source) => return Err(adapter("stream", path, source)),
        };
        let actual: String = hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        if copied != self.length || length != self.length || actual != expected {
            return Err(SourceError::Changed { path: path.into() });
        }
        Ok(())
    }
}

fn exceeds_blob_bound(source: &Error) -> bool {
    match source {
        Error::Git {
            source: error::Error::Conversion { source, .. },
        } => {
            matches!(source.as_ref(), error::Error::ByteLimit { limit } if *limit == OPAQUE_LIMIT)
        }
        Error::Limit {
            source: error::Error::ByteLimit { limit },
            ..
        } => *limit == OPAQUE_LIMIT,
        _ => false,
    }
}

struct ChannelWriter {
    sender: mpsc::SyncSender<Vec<u8>>,
}

impl Write for ChannelWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        for chunk in bytes.chunks(COPY_BYTES) {
            if self.sender.send(chunk.to_vec()).is_err() {
                return Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "asset output closed",
                ));
            }
        }
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/git_asset_stream_tests.rs"]
mod git_asset_stream_tests;

#[cfg(test)]
#[path = "_tests_/extracted_asset_digest_tests.rs"]
mod extracted_asset_digest_tests;
