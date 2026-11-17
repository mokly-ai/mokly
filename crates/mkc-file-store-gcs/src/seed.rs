//! Replaceable preview seed objects through the bounded GCS JSON API.

use bytes::Bytes;
use mkc_file_store_interface::deadline::MAX_OPERATION_DURATION;
use mkc_file_store_interface::error::{Error, IntegrityError, Result};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use reqwest::Method;
use thiserror::Error;

use crate::store::GcsFileStore;
use crate::transport::{BufferedResponseTooLarge, Request};

#[derive(Debug, Error)]
enum SeedError {
    #[error("[mkc-file-store-gcs/seed] invalid object endpoint")]
    Endpoint,
    #[error("[mkc-file-store-gcs/seed] {operation} returned HTTP {status}")]
    Provider {
        operation: &'static str,
        status: u16,
    },
}

impl SeedStore for GcsFileStore {
    fn put(&self, name: &SeedName, bytes: Bytes) -> Result<()> {
        if bytes.len() as u64 > name.max_bytes() {
            return Err(Error::internal(IntegrityError::TooLarge));
        }
        let mut url = self.endpoint(true, None)?;
        url.query_pairs_mut()
            .append_pair("uploadType", "media")
            .append_pair("name", &self.object_name(name.as_str()));
        let response = self.http.execute(Request {
            method: Method::POST,
            url: url.into(),
            body: Some(bytes),
            response_limit: 64 * 1024,
            timeout: MAX_OPERATION_DURATION,
        })?;
        match response.status {
            200 | 201 => Ok(()),
            status => Err(Error::internal(SeedError::Provider {
                operation: "put seed object",
                status,
            })),
        }
    }

    fn get(&self, name: &SeedName, max_bytes: u64) -> Result<Option<Vec<u8>>> {
        let mut url = self.endpoint(false, None)?;
        url.path_segments_mut()
            .ok()
            .ok_or_else(|| Error::internal(SeedError::Endpoint))?
            .push(&self.object_name(name.as_str()));
        url.query_pairs_mut().append_pair("alt", "media");
        let limit = max_bytes.min(name.max_bytes());
        let response = match self.http.execute(Request {
            method: Method::GET,
            url: url.into(),
            body: None,
            response_limit: limit,
            timeout: MAX_OPERATION_DURATION,
        }) {
            Err(Error::Internal(error)) => {
                let Some(oversized) = error
                    .source_chain()
                    .find_map(|cause| cause.downcast_ref::<BufferedResponseTooLarge>())
                else {
                    return Err(Error::Internal(error));
                };
                return seed_read(oversized.status, Vec::new(), true);
            }
            result => result?,
        };
        let oversized = response.body.len() as u64 > limit;
        seed_read(response.status, response.body, oversized)
    }
}

/// Interpret status first because provider error bodies are not seed objects.
fn seed_read(status: u16, bytes: Vec<u8>, oversized: bool) -> Result<Option<Vec<u8>>> {
    match status {
        200 if oversized => Err(Error::internal(IntegrityError::TooLarge)),
        200 => Ok(Some(bytes)),
        404 => Ok(None),
        status => Err(Error::internal(SeedError::Provider {
            operation: "get seed object",
            status,
        })),
    }
}
