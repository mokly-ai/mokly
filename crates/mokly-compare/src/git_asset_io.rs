//! Opaque Git inputs hash without filling the private byte LRU.

use std::io::{self, Cursor};
use std::path::Path;

use mokly_git::tree::Limits;
use mokly_model::material::digest;
use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::stream::{OpenedSource, SourceStream};

use crate::git_tree::GitTree;

impl GitTree {
    pub(crate) fn digest_file(&self, path: &Path) -> Result<String> {
        let Some(relative) = self.relative(path)? else {
            return Err(failure("digest", path, io::ErrorKind::IsADirectory));
        };
        if let Some(message) = self
            .unavailable
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&relative)
            .cloned()
        {
            return Err(SourceError::Unavailable {
                path: path.into(),
                message,
            });
        }
        if let Some(hash) = self
            .digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&relative)
            .cloned()
        {
            return Ok(hash);
        }
        if let Err(source) = self.sources.ensure(std::slice::from_ref(&relative)) {
            return Err(self.failed("digest", path, source));
        }
        let index = self.index(path)?;
        let Some(entry) = index.entries.get(&relative) else {
            return Err(failure("digest", path, io::ErrorKind::NotFound));
        };
        if !entry.mode.regular() {
            return Err(failure("digest", path, io::ErrorKind::InvalidInput));
        }
        let cached = self
            .cache
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(&relative);
        let hash = if let Some(bytes) = cached {
            digest(&bytes)
        } else {
            match self.sources.digest(&relative) {
                Ok(hash) => hash,
                Err(source) => return Err(self.failed("digest", path, source)),
            }
        };
        self.digests
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(relative, hash.clone());
        Ok(hash)
    }

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
        Ok(Box::new(OpenedSource {
            length: bytes.len() as u64,
            reader: Box::new(Cursor::new(bytes)),
        }))
    }
}

fn failure(operation: &'static str, path: &Path, kind: io::ErrorKind) -> SourceError {
    SourceError::Io {
        operation,
        path: path.into(),
        source: kind.into(),
    }
}

#[cfg(test)]
#[path = "_tests_/git_asset_io_tests.rs"]
mod git_asset_io_tests;
