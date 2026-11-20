//! Private filesystem boundary with symlink checks and atomic file publication.

use std::fs::{self, File};
use std::io::{ErrorKind, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::error::{Error, ErrorResultExt, IntegrityError, Result};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::store::{FileStore, MAX_FILE_BYTES, verify};
use tempfile::NamedTempFile;

use crate::local::LocalStore;
use crate::seed::LocalSeedStore;

/// Composition-root factory for an exclusively owned object directory.
pub trait FileStoreFactory {
    /// Prepare storage and return only the shared behavior boundary.
    fn open(&self, root: &Path) -> Result<Arc<dyn FileStore>>;
}

/// Native filesystem composition root.
pub struct LocalFileStoreFactory;

/// Composition-root factory for replaceable preview seed objects.
pub trait SeedStoreFactory {
    /// Prepare a private root and return the seed storage boundary.
    fn open_seed(&self, root: &Path) -> Result<Arc<dyn SeedStore>>;
}

impl SeedStoreFactory for LocalFileStoreFactory {
    fn open_seed(&self, root: &Path) -> Result<Arc<dyn SeedStore>> {
        let directory: Arc<dyn Directory> = Arc::new(NativeDirectory {
            root: root.to_owned(),
        });
        directory.prepare()?;
        Ok(Arc::new(LocalSeedStore { directory }))
    }
}

impl FileStoreFactory for LocalFileStoreFactory {
    fn open(&self, root: &Path) -> Result<Arc<dyn FileStore>> {
        let directory: Arc<dyn Directory> = Arc::new(NativeDirectory {
            root: root.to_owned(),
        });
        directory.prepare()?;
        Ok(Arc::new(LocalStore { directory }))
    }
}

pub(crate) trait Directory: Send + Sync {
    /// Refuse a symlink anywhere on the path, so a link cannot redirect a read
    /// or a write outside the root.
    fn check(&self, path: &Path) -> Result<()>;
    fn open_reader(&self, key: &BlobKey) -> Result<Option<(File, u64)>>;
    /// Create the private mode-0700 root; a symlink among its ancestors is refused.
    fn prepare(&self) -> Result<()>;
    fn path(&self, key: &BlobKey, create: bool) -> Result<PathBuf>;
    fn root(&self) -> &Path;
    fn read(&self, key: &BlobKey) -> Result<Option<Vec<u8>>>;
    /// Stage a private temporary file, sync it and publish it without clobbering;
    /// an object that already exists must hold identical bytes.
    fn write(&self, key: &BlobKey, bytes: &[u8]) -> Result<()>;
}

struct NativeDirectory {
    root: PathBuf,
}

impl Directory for NativeDirectory {
    fn check(&self, path: &Path) -> Result<()> {
        for ancestor in path.ancestors() {
            match fs::symlink_metadata(ancestor) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(Error::internal(IntegrityError::UnsafeEntry));
                }
                Ok(_) => (),
                Err(error) if error.kind() == ErrorKind::NotFound => (),
                result => {
                    result.context("inspect blob ancestor")?;
                }
            }
        }
        Ok(())
    }

    fn prepare(&self) -> Result<()> {
        self.check(&self.root)?;
        fs::create_dir_all(&self.root).context("create local blob root")?;
        fs::set_permissions(&self.root, fs::Permissions::from_mode(0o700))
            .context("restrict local blob root")?;
        self.check(&self.root)
    }

    fn open_reader(&self, key: &BlobKey) -> Result<Option<(File, u64)>> {
        let path = self.path(key, false)?;
        let file = match File::open(path) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            result => result.context("open local blob")?,
        };
        let metadata = file.metadata().context("inspect local blob")?;
        if !metadata.is_file() {
            return Err(Error::internal(IntegrityError::UnsafeEntry));
        }
        if metadata.len() > MAX_FILE_BYTES {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        Ok(Some((file, metadata.len())))
    }

    fn path(&self, key: &BlobKey, create: bool) -> Result<PathBuf> {
        let path = self.root.join(key.object_name());
        self.check(&path)?;
        if create && let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("create content directory")?;
            self.check(&path)?;
        }
        Ok(path)
    }

    fn root(&self) -> &Path {
        &self.root
    }

    fn read(&self, key: &BlobKey) -> Result<Option<Vec<u8>>> {
        let Some((file, _)) = self.open_reader(key)? else {
            return Ok(None);
        };
        let mut bytes = Vec::new();
        file.take(MAX_FILE_BYTES + 1)
            .read_to_end(&mut bytes)
            .context("read local blob")?;
        verify(key, &bytes)?;
        Ok(Some(bytes))
    }

    fn write(&self, key: &BlobKey, bytes: &[u8]) -> Result<()> {
        verify(key, bytes)?;
        if self.read(key)?.is_some() {
            return Ok(());
        }
        let path = self.path(key, true)?;
        let parent = path
            .parent()
            .ok_or_else(|| Error::internal(IntegrityError::UnsafeEntry))?;
        let mut temporary = NamedTempFile::new_in(parent).context("stage immutable blob")?;
        temporary.write_all(bytes).context("write staged blob")?;
        temporary.as_file().sync_all().context("sync staged blob")?;
        match temporary.persist_noclobber(&path) {
            Ok(_) => (),
            Err(error) if error.error.kind() == ErrorKind::AlreadyExists => {
                self.read(key)?
                    .ok_or_else(|| Error::internal(IntegrityError::UnsafeEntry))?;
            }
            result => {
                result.context("publish immutable blob")?;
            }
        }
        File::open(parent)
            .context("open blob directory")?
            .sync_all()
            .context("sync blob directory")
    }
}
