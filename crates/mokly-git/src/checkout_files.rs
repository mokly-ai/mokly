//! Destinations of converted files: memory for reads, a private directory for extraction.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{Error, IoResult, Result};
use crate::repository::BlobDigest;
use crate::tree::Entry;

/// The converted files of one conversion call, addressed by entry index.
pub(crate) trait BatchFiles: Send {
    /// Start the file of the entry at `index`, replacing earlier bytes.
    fn open(&mut self, index: usize) -> Result<()>;
    /// Append converted bytes to the file of the entry at `index`.
    fn write(&mut self, index: usize, bytes: &[u8]) -> Result<()>;
}

/// Converted bytes kept in memory; reads return them without a disk copy.
pub(crate) struct MemoryFiles {
    files: Vec<Vec<u8>>,
}

impl MemoryFiles {
    pub(crate) fn new(count: usize) -> Self {
        Self {
            files: vec![Vec::new(); count],
        }
    }

    pub(crate) fn into_files(self) -> Vec<Vec<u8>> {
        self.files
    }
}

impl BatchFiles for MemoryFiles {
    fn open(&mut self, index: usize) -> Result<()> {
        let Some(file) = self.files.get_mut(index) else {
            return Err(Error::MalformedOutput);
        };
        file.clear();
        Ok(())
    }

    fn write(&mut self, index: usize, bytes: &[u8]) -> Result<()> {
        let Some(file) = self.files.get_mut(index) else {
            return Err(Error::MalformedOutput);
        };
        file.extend_from_slice(bytes);
        Ok(())
    }
}

/// Converted files in a private directory, so a large file never has to fit in memory.
pub(crate) struct DirectoryFiles<'a> {
    directory: &'a Path,
    paths: Vec<Option<PathBuf>>,
    current: Option<(usize, fs::File)>,
}

impl<'a> DirectoryFiles<'a> {
    pub(crate) fn new(directory: &'a Path, count: usize) -> Self {
        Self {
            directory,
            paths: vec![None; count],
            current: None,
        }
    }

    /// The file of each entry, in entry order; an entry that was never opened has none.
    pub(crate) fn into_paths(self) -> Vec<Option<PathBuf>> {
        self.paths
    }
}

impl BatchFiles for DirectoryFiles<'_> {
    fn open(&mut self, index: usize) -> Result<()> {
        let Some(slot) = self.paths.get_mut(index) else {
            return Err(Error::MalformedOutput);
        };
        let path = self.directory.join(format!("converted-{index}"));
        self.current = Some((index, fs::File::create(&path).git()?));
        *slot = Some(path);
        Ok(())
    }

    fn write(&mut self, index: usize, bytes: &[u8]) -> Result<()> {
        match &mut self.current {
            Some((current, file)) if *current == index => file.write_all(bytes).git(),
            _ => Err(Error::MalformedOutput),
        }
    }
}

/// Maps the positions of a batch subset to the entry indices of the whole call.
pub(crate) struct Indexed<'a> {
    pub(crate) files: &'a mut dyn BatchFiles,
    pub(crate) indices: &'a [usize],
}

impl Indexed<'_> {
    fn index(&self, position: usize) -> Result<usize> {
        self.indices
            .get(position)
            .copied()
            .ok_or(Error::MalformedOutput)
    }
}

impl BatchFiles for Indexed<'_> {
    fn open(&mut self, position: usize) -> Result<()> {
        let index = self.index(position)?;
        self.files.open(index)
    }

    fn write(&mut self, position: usize, bytes: &[u8]) -> Result<()> {
        let index = self.index(position)?;
        self.files.write(index, bytes)
    }
}

/// A `Write` view of one entry's file for a single-file stream; counts its bytes.
pub(crate) struct EntryWriter<'a> {
    files: &'a mut dyn BatchFiles,
    index: usize,
    written: usize,
    failure: Option<Error>,
}

/// Hashes each converted file as the checkout batch writes it.
pub(crate) struct DigestFiles {
    hashes: Vec<Option<(Sha256, usize)>>,
    limit: usize,
}

impl DigestFiles {
    pub(crate) fn new(entries: &[Entry], limit: usize) -> Self {
        Self {
            hashes: vec![None; entries.len()],
            limit,
        }
    }

    pub(crate) fn into_digests(self) -> Result<Vec<BlobDigest>> {
        self.hashes
            .into_iter()
            .map(|hash| {
                let Some((hash, length)) = hash else {
                    return Err(Error::MalformedOutput);
                };
                let digest = hash
                    .finalize()
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect();
                Ok(BlobDigest { digest, length })
            })
            .collect()
    }
}

impl BatchFiles for DigestFiles {
    fn open(&mut self, index: usize) -> Result<()> {
        let Some(slot) = self.hashes.get_mut(index) else {
            return Err(Error::MalformedOutput);
        };
        *slot = Some((Sha256::new(), 0));
        Ok(())
    }

    fn write(&mut self, index: usize, bytes: &[u8]) -> Result<()> {
        let Some(Some((hash, length))) = self.hashes.get_mut(index) else {
            return Err(Error::MalformedOutput);
        };
        *length = length.saturating_add(bytes.len());
        if *length > self.limit {
            return Err(Error::ByteLimit { limit: self.limit });
        }
        hash.update(bytes);
        Ok(())
    }
}

impl<'a> EntryWriter<'a> {
    pub(crate) fn new(files: &'a mut dyn BatchFiles, index: usize) -> Self {
        Self {
            files,
            index,
            written: 0,
            failure: None,
        }
    }

    pub(crate) fn written(&self) -> usize {
        self.written
    }

    /// The typed store failure that stopped the stream, with the real OS
    /// error as its source; it wins over the copy error.
    pub(crate) fn failure(&mut self) -> Option<Error> {
        self.failure.take()
    }
}

impl Write for EntryWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.failure.is_none()
            && let Err(error) = self.files.write(self.index, bytes)
        {
            self.failure = Some(error);
        }
        if self.failure.is_some() {
            return Err(io::Error::other("the converted file stopped"));
        }
        self.written = self.written.saturating_add(bytes.len());
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
