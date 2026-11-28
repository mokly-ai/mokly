//! Limit the accepted catalogue indexes that readers can hold in this process.

use std::future::Future;
use std::pin::pin;
use std::result;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};
use std::thread::{self, Thread};

use internal_error::InternalError;
use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::store::FileStore;
use mkc_mokly_contract::error::Error as ContractError;
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::limits::Limits;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

/// Failure to load an accepted catalogue index.
#[derive(Debug, thiserror::Error, internal_error::ErrorContract)]
pub enum Error {
    /// The stored bytes failed catalogue validation.
    #[error("[mkc-publications/stored_index] invalid catalogue index: {0}")]
    Invalid(#[source] ContractError),
    /// Storage or decoding failed unexpectedly.
    #[error("[mkc-publications/stored_index] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Result of a stored catalogue index read.
pub type Result<T> = result::Result<T, Error>;

/// A parsed index whose read permit stays held until its facts are dropped.
#[derive(Debug)]
pub struct LoadedIndex {
    index: CatalogueIndex,
    _permit: OwnedSemaphorePermit,
}

impl LoadedIndex {
    /// Borrow the parsed facts for as long as the read permit is held.
    pub fn index(&self) -> &CatalogueIndex {
        &self.index
    }
}

/// Load previously accepted index bytes from immutable storage.
#[unimock::unimock(api = StoredIndexReaderMock)]
pub trait StoredIndexReader: Send + Sync {
    /// Wait on the calling blocking thread and return `None` if the object is missing.
    fn load(&self, key: &BlobKey) -> Result<Option<LoadedIndex>>;
}

/// Shared reader for completion, the viewer and check delivery.
pub struct BoundedStoredIndexReader {
    files: Arc<dyn FileStore>,
    slots: Arc<Semaphore>,
}

impl BoundedStoredIndexReader {
    /// Create the process's shared stored-index reader.
    pub fn new(files: Arc<dyn FileStore>) -> Self {
        Self {
            files,
            slots: Arc::new(Semaphore::new(2)),
        }
    }

    async fn load_when_ready(&self, key: &BlobKey) -> Result<Option<LoadedIndex>> {
        let permit = self
            .slots
            .clone()
            .acquire_owned()
            .await
            .context("wait for a stored catalogue index slot")?;
        let Some(bytes) = self
            .files
            .get(key)
            .context("read stored catalogue index bytes")?
        else {
            return Ok(None);
        };
        let index = match CatalogueIndex::parse(&bytes, Limits::default()) {
            Ok(index) => index,
            Err(
                error @ (ContractError::UnsupportedVersion { .. }
                | ContractError::Invalid { .. }
                | ContractError::TooLarge { .. }),
            ) => {
                return Err(Error::Invalid(error));
            }
            Err(error) => return Err(Error::internal(error)),
        };
        Ok(Some(LoadedIndex {
            index,
            _permit: permit,
        }))
    }
}

impl StoredIndexReader for BoundedStoredIndexReader {
    fn load(&self, key: &BlobKey) -> Result<Option<LoadedIndex>> {
        let mut read = pin!(self.load_when_ready(key));
        let waker = Waker::from(Arc::new(BlockingReader(thread::current())));
        let mut context = Context::from_waker(&waker);
        loop {
            match read.as_mut().poll(&mut context) {
                Poll::Ready(result) => return result,
                Poll::Pending => thread::park(),
            }
        }
    }
}

/// Wake the waiting blocking caller when the semaphore returns a slot.
struct BlockingReader(Thread);

impl Wake for BlockingReader {
    fn wake(self: Arc<Self>) {
        self.0.unpark();
    }

    fn wake_by_ref(self: &Arc<Self>) {
        self.0.unpark();
    }
}

#[cfg(test)]
#[path = "_tests_/stored_index_tests.rs"]
mod tests;
