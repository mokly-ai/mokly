//! Non-following filesystem operations for output ownership and recovery.

use std::fs;
use std::io::{self, Read, Write};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::error::{Error, IoResult, Result};
use crate::file_read;

/// Exact directory identity captured before rendering.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity {
    /// Native device and file index where supported.
    pub native: (u64, u64),
    /// Filesystem creation time, where available.
    pub created: Option<SystemTime>,
}

/// Non-following entry shape.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Entry {
    /// Regular directory with exact identity.
    Directory(Identity),
    /// Regular file with its byte length.
    File(u64),
    /// Symbolic link or unsupported node.
    Unsafe,
}

/// Narrow write boundary; tests inject races at individual operations.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FilesMock))]
pub trait Files: Send + Sync {
    /// Inspect one entry without following the final symlink.
    fn entry(&self, path: &Path) -> Result<Option<Entry>>;
    /// Resolve existing ancestors and append missing path segments.
    fn project(&self, path: &Path) -> Result<PathBuf>;
    /// List direct children only.
    fn children(&self, path: &Path) -> Result<Vec<PathBuf>>;
    /// Read a bounded regular file without trusting marker sizes.
    fn read(&self, path: &Path, limit: usize) -> Result<Vec<u8>>;
    /// Stream a source digest without imposing an output-file size limit.
    fn hash(&self, path: &Path) -> Result<String>;
    /// Read symlink text without following its target.
    fn link(&self, path: &Path) -> Result<PathBuf>;
    /// Create exactly one absent directory.
    fn mkdir(&self, path: &Path) -> Result<()>;
    /// Create a file exclusively.
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()>;
    /// Unlink one file or symlink.
    fn unlink(&self, path: &Path) -> Result<()>;
    /// Remove an empty directory only.
    fn rmdir(&self, path: &Path) -> Result<()>;
    /// Remove only a private operation-owned stage, the one recursive removal.
    /// A non-following stat makes a link or a file at that path fail.
    fn remove_stage(&self, path: &Path) -> Result<()>;
}

/// Host adapter. Recursive deletion is exposed only for the private stage.
pub struct SystemFiles;

impl Files for SystemFiles {
    fn entry(&self, path: &Path) -> Result<Option<Entry>> {
        let metadata = match fs::symlink_metadata(path) {
            Ok(value) => value,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            result => result.at("stat", path)?,
        };
        Ok(Some(if metadata.file_type().is_symlink() {
            Entry::Unsafe
        } else if metadata.is_dir() {
            #[cfg(unix)]
            let identity = identity(&metadata);
            #[cfg(windows)]
            let identity = crate::windows_identity::identity(path)?;
            Entry::Directory(identity)
        } else if metadata.is_file() {
            Entry::File(metadata.len())
        } else {
            Entry::Unsafe
        }))
    }
    fn project(&self, path: &Path) -> Result<PathBuf> {
        let mut cursor = path.to_path_buf();
        let mut missing = Vec::new();
        loop {
            match dunce::canonicalize(&cursor) {
                Ok(mut real) => {
                    for name in missing.iter().rev() {
                        real.push(name);
                    }
                    return Ok(real);
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    if let Some(name) = cursor.file_name() {
                        missing.push(name.to_owned());
                    }
                    if !cursor.pop() {
                        return Err(Error::Destination { path: path.into() });
                    }
                }
                result => return result.at("resolve", path),
            }
        }
    }
    fn children(&self, path: &Path) -> Result<Vec<PathBuf>> {
        let mut children = Vec::new();
        for child in fs::read_dir(path).at("list", path)? {
            children.push(child.at("list child", path)?.path());
        }
        children.sort();
        Ok(children)
    }
    fn read(&self, path: &Path, limit: usize) -> Result<Vec<u8>> {
        if !matches!(self.entry(path)?, Some(Entry::File(size)) if size <= limit as u64) {
            return Err(Error::Unexpected { path: path.into() });
        }
        let mut bytes = Vec::new();
        file_read::open(path)?
            .take(limit as u64 + 1)
            .read_to_end(&mut bytes)
            .at("read", path)?;
        if bytes.len() > limit {
            return Err(Error::Unexpected { path: path.into() });
        }
        Ok(bytes)
    }
    fn hash(&self, path: &Path) -> Result<String> {
        file_read::hash(path)
    }
    fn link(&self, path: &Path) -> Result<PathBuf> {
        fs::read_link(path).at("read symlink", path)
    }
    fn mkdir(&self, path: &Path) -> Result<()> {
        fs::create_dir(path).at("create directory", path)
    }
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<()> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .at("create file", path)?;
        file.write_all(bytes).at("write", path)
    }
    fn unlink(&self, path: &Path) -> Result<()> {
        fs::remove_file(path).at("unlink", path)
    }
    fn rmdir(&self, path: &Path) -> Result<()> {
        fs::remove_dir(path).at("remove directory", path)
    }
    fn remove_stage(&self, path: &Path) -> Result<()> {
        match self.entry(path)? {
            None => Ok(()),
            Some(Entry::Directory(_)) => fs::remove_dir_all(path).at("remove private stage", path),
            Some(_) => Err(Error::Unexpected { path: path.into() }),
        }
    }
}

#[cfg(unix)]
fn identity(metadata: &fs::Metadata) -> Identity {
    #[cfg(unix)]
    let native = { (metadata.dev(), metadata.ino()) };
    Identity {
        native,
        created: metadata.created().ok(),
    }
}
