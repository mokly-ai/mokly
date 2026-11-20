//! Single-flight cache and asynchronous storage selection for response bodies.

use std::future;

use bytes::{Bytes, BytesMut};
use futures_util::{StreamExt, stream};
use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::error::IntegrityError;
use mkc_file_store_interface::stream::{BlobBody, BlobStream, ByteRange};

use crate::cache::{CacheFill, MAX_CACHED_BLOB_BYTES};
use crate::catalogue::PublishedCatalogue;
use crate::error::{Error, ErrorResultExt, Result};

impl PublishedCatalogue {
    /// Called only with a key that authorization and exact path lookup produced.
    /// A ranged miss opens just its storage range and never admits it; a waiter
    /// whose fill failed streams from storage instead of filling again.
    pub(super) async fn open_body(
        &self,
        key: &BlobKey,
        length: u64,
        range: Option<ByteRange>,
    ) -> Result<BlobStream> {
        let Some(cache) = self
            .cache
            .as_deref()
            .filter(|_| length <= MAX_CACHED_BLOB_BYTES)
        else {
            return self.open_storage(key, length, range).await;
        };
        if range.is_some() {
            return match cache.get(key).context("read catalogue hot cache")? {
                Some(bytes) => memory_stream(key, length, range, bytes),
                None => self.open_storage(key, length, range).await,
            };
        }
        match cache
            .begin_fill(key, length)
            .context("reserve catalogue hot-cache fill")?
        {
            CacheFill::Hit(bytes) => memory_stream(key, length, None, bytes),
            CacheFill::Wait(waiter) => {
                match waiter
                    .wait()
                    .await
                    .context("wait for catalogue hot-cache fill")?
                {
                    Some(bytes) => memory_stream(key, length, None, bytes),
                    None => self.open_storage(key, length, None).await,
                }
            }
            CacheFill::Reserved(reservation) => {
                let stream = self.open_storage(key, length, None).await?;
                let bytes = collect_verified(stream, length).await?;
                let bytes = reservation
                    .complete(bytes)
                    .context("complete catalogue hot-cache fill")?;
                memory_stream(key, length, None, bytes)
            }
            CacheFill::Bypass => self.open_storage(key, length, None).await,
        }
    }

    async fn open_storage(
        &self,
        key: &BlobKey,
        length: u64,
        range: Option<ByteRange>,
    ) -> Result<BlobStream> {
        let stream = self
            .files
            .open(key, range)
            .await
            .context("read isolated catalogue blob")?
            .ok_or(Error::NotFound)?;
        if stream.total_length() != length || stream.served_range() != range {
            return Err(Error::internal(IntegrityError::LengthMismatch));
        }
        Ok(stream)
    }
}

async fn collect_verified(stream: BlobStream, length: u64) -> Result<Bytes> {
    let capacity = usize::try_from(length).context("size catalogue hot-cache object")?;
    let mut verified = BytesMut::with_capacity(capacity);
    let mut body = stream.into_body();
    while let Some(item) = body.next().await {
        let bytes = item.context("verify catalogue hot-cache object")?;
        verified.extend_from_slice(&bytes);
    }
    if verified.len() as u64 != length {
        return Err(Error::internal(IntegrityError::LengthMismatch));
    }
    Ok(verified.freeze())
}

fn memory_stream(
    key: &BlobKey,
    length: u64,
    range: Option<ByteRange>,
    bytes: Bytes,
) -> Result<BlobStream> {
    if bytes.len() as u64 != length {
        return Err(Error::internal(IntegrityError::LengthMismatch));
    }
    if let Some(range) = range {
        let start = usize::try_from(range.start()).context("start cached catalogue range")?;
        let end = usize::try_from(range.end() + 1).context("end cached catalogue range")?;
        return BlobStream::ranged(length, range, once(bytes.slice(start..end)))
            .context("open ranged catalogue hot-cache object");
    }
    BlobStream::full(key, length, once(bytes)).context("open complete catalogue hot-cache object")
}

fn once(bytes: Bytes) -> BlobBody {
    Box::pin(stream::once(future::ready(Ok(bytes))))
}

#[cfg(test)]
#[path = "_tests_/delivery_tests.rs"]
mod tests;
