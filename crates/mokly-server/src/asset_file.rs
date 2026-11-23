//! Request-owned temporary files and hashing as bytes are written.

use std::fs::File;
use std::io::{self, Read, Write};
#[cfg(unix)]
use std::os::unix::fs::FileExt;
#[cfg(windows)]
use std::os::windows::fs::FileExt;

use axum::http::HeaderValue;
use flate2::Compression;
use flate2::write::GzEncoder;
use sha2::{Digest, Sha256};

use crate::error::{InternalError, Result, ServerError};
use crate::public_read::OpenedFile;
use crate::validator;

/// An unnamed copy that can calculate its SHA-256 during the write.
pub(crate) struct CaptureWriter {
    file: File,
    length: u64,
    sha: Option<Sha256>,
}

impl CaptureWriter {
    /// Open temporary storage with an optional strong digest accumulator.
    pub(crate) fn new(hash: bool) -> io::Result<Self> {
        Ok(Self {
            file: tempfile::tempfile()?,
            length: 0,
            sha: hash.then(Sha256::new),
        })
    }

    /// Transfer the completed file and the tag, when the writer calculated one.
    pub(crate) fn finish(self, content_type: String) -> Result<(OpenedFile, Option<HeaderValue>)> {
        let tag = self
            .sha
            .map(|sha| validator::hash(&sha.finalize()))
            .transpose()?;
        Ok((
            OpenedFile {
                file: self.file,
                length: self.length,
                content_type,
            },
            tag,
        ))
    }
}

impl Write for CaptureWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let count = self.file.write(bytes)?;
        self.length += count as u64;
        if let Some(sha) = &mut self.sha {
            sha.update(&bytes[..count]);
        }
        Ok(count)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.file.flush()
    }
}

/// Fixed-size metadata for deterministic gzip output of one identity version.
#[derive(Clone)]
pub(crate) struct GzipMetadata {
    pub(crate) length: u64,
    pub(crate) etag: HeaderValue,
}

/// Create a gzip copy and reuse a known tag or hash the encoded bytes as they are written.
pub(crate) fn gzip_copy(
    source: &OpenedFile,
    known: Option<GzipMetadata>,
) -> Result<(OpenedFile, GzipMetadata)> {
    let writer = match write_gzip(source, known.is_none()) {
        Ok(writer) => writer,
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    let (opened, tag) = writer.finish(source.content_type.clone())?;
    let metadata = match known {
        Some(known) if known.length == opened.length => known,
        Some(_) => return Err(ServerError::InvalidAssets),
        None => GzipMetadata {
            length: opened.length,
            etag: tag.ok_or(ServerError::InvalidAssets)?,
        },
    };
    Ok((opened, metadata))
}

fn write_gzip(source: &OpenedFile, hash: bool) -> io::Result<CaptureWriter> {
    let mut encoder = GzEncoder::new(CaptureWriter::new(hash)?, Compression::fast());
    io::copy(&mut AtOffset::new(source, 0), &mut encoder)?;
    encoder.finish()
}

/// A reader limited to a capture's length, with its own byte offset.
pub(crate) struct AtOffset<'a> {
    opened: &'a OpenedFile,
    offset: u64,
}

impl<'a> AtOffset<'a> {
    /// Start at the caller's offset without changing another reader's position.
    pub(crate) fn new(opened: &'a OpenedFile, offset: u64) -> Self {
        Self { opened, offset }
    }
}

impl Read for AtOffset<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        let count = (self.opened.length - self.offset).min(buffer.len() as u64) as usize;
        let buffer = &mut buffer[..count];
        #[cfg(unix)]
        let length = self.opened.file.read_at(buffer, self.offset)?;
        #[cfg(windows)]
        let length = self.opened.file.seek_read(buffer, self.offset)?;
        self.offset += length as u64;
        Ok(length)
    }
}
