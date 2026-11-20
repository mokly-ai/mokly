//! Streaming GCS media reads with exact status and length validation.

use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::error::{Error, Result};
use mkc_file_store_interface::store::MAX_FILE_BYTES;
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use thiserror::Error;

use crate::store::GcsFileStore;
use crate::transport::StreamRequest;

#[derive(Debug, Error)]
enum MediaError {
    #[error("[mkc-file-store-gcs/media] media read expected HTTP {expected}, received {actual}")]
    Status { expected: u16, actual: u16 },
    #[error("[mkc-file-store-gcs/media] media response length headers do not match the object")]
    LengthHeaders,
}

impl GcsFileStore {
    pub(crate) async fn open_media(
        &self,
        key: &BlobKey,
        range: Option<ByteRange>,
    ) -> Result<Option<BlobStream>> {
        let mut url = self.endpoint(false, Some(key))?;
        url.query_pairs_mut().append_pair("alt", "media");
        let response = self
            .http
            .open(StreamRequest {
                url: url.into(),
                range,
                response_limit: range.map_or(MAX_FILE_BYTES, ByteRange::length),
            })
            .await?;
        if response.status == 404 {
            return Ok(None);
        }
        match range {
            Some(range) => {
                if response.status != 206 {
                    return Err(Error::internal(MediaError::Status {
                        expected: 206,
                        actual: response.status,
                    }));
                }
                let content_range = response
                    .content_range
                    .as_deref()
                    .and_then(parse_content_range);
                if response.content_length != Some(range.length()) || content_range != Some(range) {
                    return Err(Error::internal(MediaError::LengthHeaders));
                }
                Ok(Some(BlobStream::ranged(
                    range.total_length(),
                    range,
                    response.body,
                )?))
            }
            None => {
                if response.status != 200 {
                    return Err(Error::internal(MediaError::Status {
                        expected: 200,
                        actual: response.status,
                    }));
                }
                let Some(total_length) = response.content_length else {
                    return Err(Error::internal(MediaError::LengthHeaders));
                };
                if response.content_range.is_some() {
                    return Err(Error::internal(MediaError::LengthHeaders));
                }
                Ok(Some(BlobStream::full(key, total_length, response.body)?))
            }
        }
    }
}

fn parse_content_range(value: &str) -> Option<ByteRange> {
    let (offsets, total_length) = value.strip_prefix("bytes ")?.split_once('/')?;
    let (start, end) = offsets.split_once('-')?;
    ByteRange::new(
        start.parse().ok()?,
        end.parse().ok()?,
        total_length.parse().ok()?,
    )
}
