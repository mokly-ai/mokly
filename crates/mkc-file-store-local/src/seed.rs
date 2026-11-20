//! Replaceable seed objects in the same private root as immutable content.

use std::fs::{self, File};
use std::io::{ErrorKind, Read, Write};
use std::path::PathBuf;
use std::sync::Arc;

use bytes::Bytes;
use mkc_file_store_interface::error::{Error, ErrorResultExt, IntegrityError, Result};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use tempfile::NamedTempFile;

use crate::directory::Directory;

/// Local implementation behind the seed factory's trait object.
pub(crate) struct LocalSeedStore {
    /// The shared private directory boundary and its ancestor checks.
    pub(crate) directory: Arc<dyn Directory>,
}

impl SeedStore for LocalSeedStore {
    fn put(&self, name: &SeedName, bytes: Bytes) -> Result<()> {
        if bytes.len() as u64 > name.max_bytes() {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        let path = self.path(name, true)?;
        let parent = path
            .parent()
            .ok_or_else(|| Error::internal(IntegrityError::UnsafeEntry))?;
        let mut temporary = NamedTempFile::new_in(parent).context("stage seed object")?;
        temporary
            .write_all(&bytes)
            .context("write staged seed object")?;
        temporary
            .as_file()
            .sync_all()
            .context("sync staged seed object")?;
        self.directory.check(&path)?;
        temporary.persist(&path).context("replace seed object")?;
        File::open(parent)
            .context("open seed directory")?
            .sync_all()
            .context("sync seed directory")
    }

    fn get(&self, name: &SeedName, max_bytes: u64) -> Result<Option<Vec<u8>>> {
        let path = self.path(name, false)?;
        let file = match File::open(path) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            result => result.context("open seed object")?,
        };
        let metadata = file.metadata().context("inspect seed object")?;
        if !metadata.is_file() {
            return Err(Error::internal(IntegrityError::UnsafeEntry));
        }
        let limit = max_bytes.min(name.max_bytes());
        if metadata.len() > limit {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        let mut bytes = Vec::new();
        file.take(limit + 1)
            .read_to_end(&mut bytes)
            .context("read seed object")?;
        if bytes.len() as u64 > limit {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        Ok(Some(bytes))
    }
}

impl LocalSeedStore {
    /// Validate ancestors and the leaf before opening or replacing a file.
    fn path(&self, name: &SeedName, create: bool) -> Result<PathBuf> {
        let path = self.directory.root().join(name.as_str());
        self.directory.check(&path)?;
        match fs::symlink_metadata(&path) {
            Ok(metadata) if !metadata.is_file() => {
                return Err(Error::internal(IntegrityError::UnsafeEntry));
            }
            Ok(_) => (),
            Err(error) if error.kind() == ErrorKind::NotFound => (),
            result => {
                result.context("inspect seed path")?;
            }
        }
        if create && let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("create seed directory")?;
            self.directory.check(&path)?;
        }
        Ok(path)
    }
}
