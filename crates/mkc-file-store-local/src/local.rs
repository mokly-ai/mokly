//! Native object operations and bounded-memory local object pagination.

use std::collections::BTreeMap;
use std::fs;
use std::io::{ErrorKind, SeekFrom};
use std::sync::Arc;

use bytes::Bytes;
use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::error::{Error, ErrorResultExt, IntegrityError, Result};
use mkc_file_store_interface::store::{FileStore, MAX_FILE_BYTES, ObjectPage, StoredObject};
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::directory::Directory;

pub(crate) struct LocalStore {
    pub(crate) directory: Arc<dyn Directory>,
}

#[async_trait::async_trait]
impl FileStore for LocalStore {
    fn put(&self, key: &BlobKey, bytes: Bytes, deadline: OperationDeadline) -> Result<()> {
        deadline.ensure_remaining()?;
        self.directory.write(key, &bytes)
    }

    fn get(&self, key: &BlobKey) -> Result<Option<Vec<u8>>> {
        self.directory.read(key)
    }

    /// Refuse a symlink on the path, open the file, refuse the handle unless it
    /// is a regular file within the size cap, then read it with Tokio: a full
    /// open verifies through `BlobStream::full`, a ranged open seeks to the
    /// start and exposes exactly the selected bytes.
    async fn open(&self, key: &BlobKey, range: Option<ByteRange>) -> Result<Option<BlobStream>> {
        let directory = self.directory.clone();
        let path_key = key.clone();
        let path = tokio::task::spawn_blocking(move || directory.path(&path_key, false))
            .await
            .context("join local blob path validation")??;
        let mut file = match tokio::fs::File::open(path).await {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            result => result.context("open local blob")?,
        };
        let metadata = file.metadata().await.context("inspect local blob")?;
        if !metadata.is_file() {
            return Err(Error::internal(IntegrityError::UnsafeEntry));
        }
        let total_length = metadata.len();
        if total_length > MAX_FILE_BYTES {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        let stream = match range {
            Some(range) => {
                file.seek(SeekFrom::Start(range.start()))
                    .await
                    .context("seek local blob range")?;
                let body = ReaderStream::with_capacity(file.take(range.length()), 64 * 1024);
                BlobStream::ranged(total_length, range, Box::pin(body))?
            }
            None => {
                let body = ReaderStream::with_capacity(file, 64 * 1024);
                BlobStream::full(key, total_length, Box::pin(body))?
            }
        };
        Ok(Some(stream))
    }

    fn delete(&self, key: &BlobKey) -> Result<()> {
        let path = self.directory.path(key, false)?;
        match fs::remove_file(&path) {
            Ok(()) => (),
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
            result => result.context("delete local blob")?,
        }
        if let Some(parent) = path.parent() {
            match fs::remove_dir(parent) {
                Ok(()) => (),
                Err(error)
                    if matches!(
                        error.kind(),
                        ErrorKind::DirectoryNotEmpty | ErrorKind::NotFound
                    ) => {}
                result => result.context("remove empty content directory")?,
            }
        }
        Ok(())
    }

    /// An object's age is the modification time set by its atomic publish.
    fn list(&self, cursor: Option<&str>, limit: u32) -> Result<ObjectPage> {
        let limit = limit.clamp(1, 1000) as usize;
        let root = self.directory.root().join("sha256");
        self.directory.check(&root)?;
        let directories = match fs::read_dir(root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Ok(ObjectPage {
                    items: Vec::new(),
                    next_cursor: None,
                });
            }
            result => result.context("enumerate content hashes")?,
        };
        let mut page = BTreeMap::new();
        for entry in directories {
            let entry = entry.context("read content directory entry")?;
            if !entry.file_type().context("inspect content entry")?.is_dir() {
                continue;
            }
            for object in fs::read_dir(entry.path()).context("enumerate incarnations")? {
                let object = object.context("read incarnation entry")?;
                let name = format!(
                    "sha256/{}/{}",
                    entry.file_name().to_string_lossy(),
                    object.file_name().to_string_lossy()
                );
                let Some(key) = BlobKey::from_object_name(&name) else {
                    continue;
                };
                if cursor.is_some_and(|cursor| name.as_str() <= cursor)
                    || !object.file_type().context("inspect incarnation")?.is_file()
                {
                    continue;
                }
                let created_at = object
                    .metadata()
                    .context("inspect object time")?
                    .modified()
                    .context("read object time")?
                    .into();
                page.insert(name, StoredObject { key, created_at });
                if page.len() > limit + 1 {
                    page.pop_last();
                }
            }
        }
        let next_cursor = if page.len() > limit {
            page.pop_last();
            page.last_key_value().map(|(key, _)| key.clone())
        } else {
            None
        };
        Ok(ObjectPage {
            items: page.into_values().collect(),
            next_cursor,
        })
    }
}
