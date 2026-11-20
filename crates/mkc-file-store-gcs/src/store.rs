//! Content-addressed GCS objects through the public JSON API.

use std::sync::Arc;

use bytes::Bytes;
use chrono::{DateTime, Utc};
use mkc_domain::blob::BlobKey;
use mkc_file_store_interface::deadline::{MAX_OPERATION_DURATION, OperationDeadline};
use mkc_file_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_file_store_interface::prefix::ObjectPrefix;
use mkc_file_store_interface::store::{
    FileStore, MAX_FILE_BYTES, ObjectPage, StoredObject, verify,
};
use mkc_file_store_interface::stream::{BlobStream, ByteRange};
use reqwest::Method;
use serde::Deserialize;
use thiserror::Error;
use url::Url;

use crate::deadline::{Clock, RequestBudget, SystemClock};
use crate::transport::{Http, Request};

/// Composition-root configuration. Bucket and endpoint are trusted settings.
pub struct GcsFileStore {
    endpoint: String,
    bucket: String,
    prefix: Option<ObjectPrefix>,
    pub(crate) http: Arc<dyn Http>,
    clock: Arc<dyn Clock>,
}

#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/store] {operation} returned HTTP {status}")]
struct ProviderFailure {
    operation: &'static str,
    status: u16,
}

#[derive(Debug, Error)]
#[error(
    "[mkc-file-store-gcs/store] existing object size {actual} does not match local size {expected}"
)]
struct ExistingObjectSizeMismatch {
    expected: u64,
    actual: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Listing {
    #[serde(default)]
    items: Vec<Object>,
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Object {
    name: String,
    time_created: DateTime<Utc>,
}

#[derive(Deserialize)]
struct ObjectMetadata {
    /// GCS encodes the object size as a decimal JSON string.
    size: String,
}

impl GcsFileStore {
    /// Construct the production adapter with the process monotonic clock.
    pub fn new(
        endpoint: String,
        bucket: String,
        prefix: Option<ObjectPrefix>,
        http: Arc<dyn Http>,
    ) -> Self {
        Self::with_clock(endpoint, bucket, prefix, http, Arc::new(SystemClock))
    }

    /// Construct the adapter with an injected monotonic clock.
    pub fn with_clock(
        endpoint: String,
        bucket: String,
        prefix: Option<ObjectPrefix>,
        http: Arc<dyn Http>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            endpoint,
            bucket,
            prefix,
            http,
            clock,
        }
    }

    /// Apply the configured physical namespace to a logical object name.
    pub(crate) fn object_name(&self, name: &str) -> String {
        match &self.prefix {
            Some(prefix) => format!("{}/{name}", prefix.as_str()),
            None => name.to_owned(),
        }
    }

    pub(crate) fn endpoint(&self, upload: bool, key: Option<&BlobKey>) -> Result<Url> {
        let mut url = Url::parse(&self.endpoint).context("parse GCS origin")?;
        {
            let mut segments = match url.path_segments_mut() {
                Ok(segments) => segments,
                Err(()) => {
                    return Err(Error::internal(ProviderFailure {
                        operation: "configure origin",
                        status: 0,
                    }));
                }
            };
            segments.clear();
            if upload {
                segments.push("upload");
            }
            segments.extend(["storage", "v1", "b", &self.bucket, "o"]);
            if let Some(key) = key {
                segments.push(&self.object_name(&key.object_name()));
            }
        }
        Ok(url)
    }

    fn confirm_existing(&self, key: &BlobKey, expected: u64, budget: &RequestBudget) -> Result<()> {
        let mut url = self.endpoint(false, Some(key))?;
        url.query_pairs_mut().append_pair("fields", "size");
        let response = self.http.execute(Request {
            method: Method::GET,
            url: url.into(),
            body: None,
            response_limit: 64 * 1024,
            timeout: budget.remaining()?,
        })?;
        if response.status != 200 {
            return Err(Error::internal(ProviderFailure {
                operation: "read existing upload metadata",
                status: response.status,
            }));
        }
        let metadata: ObjectMetadata =
            serde_json::from_slice(&response.body).context("decode GCS object metadata")?;
        let actual = metadata
            .size
            .parse::<u64>()
            .context("parse GCS object size")?;
        if actual != expected {
            return Err(Error::internal(ExistingObjectSizeMismatch {
                expected,
                actual,
            }));
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl FileStore for GcsFileStore {
    /// Conditional create: a 412 confirms the existing object's size instead of
    /// downloading it.
    fn put(&self, key: &BlobKey, bytes: Bytes, deadline: OperationDeadline) -> Result<()> {
        let budget = RequestBudget::new(deadline, self.clock.clone())?;
        verify(key, &bytes)?;
        let length = bytes.len() as u64;
        let mut url = self.endpoint(true, None)?;
        url.query_pairs_mut()
            .append_pair("uploadType", "media")
            .append_pair("name", &self.object_name(&key.object_name()))
            .append_pair("ifGenerationMatch", "0");
        let response = self.http.execute(Request {
            method: Method::POST,
            url: url.into(),
            body: Some(bytes),
            response_limit: 64 * 1024,
            timeout: budget.remaining()?,
        })?;
        match response.status {
            200 | 201 => Ok(()),
            412 => self.confirm_existing(key, length, &budget),
            status => Err(Error::internal(ProviderFailure {
                operation: "insert object",
                status,
            })),
        }
    }

    fn get(&self, key: &BlobKey) -> Result<Option<Vec<u8>>> {
        let mut url = self.endpoint(false, Some(key))?;
        url.query_pairs_mut().append_pair("alt", "media");
        let response = self.http.execute(Request {
            method: Method::GET,
            url: url.into(),
            body: None,
            response_limit: MAX_FILE_BYTES,
            timeout: MAX_OPERATION_DURATION,
        })?;
        match response.status {
            200 => {
                verify(key, &response.body)?;
                Ok(Some(response.body))
            }
            404 => Ok(None),
            status => Err(Error::internal(ProviderFailure {
                operation: "get object",
                status,
            })),
        }
    }

    async fn open(&self, key: &BlobKey, range: Option<ByteRange>) -> Result<Option<BlobStream>> {
        self.open_media(key, range).await
    }

    fn delete(&self, key: &BlobKey) -> Result<()> {
        let response = self.http.execute(Request {
            method: Method::DELETE,
            url: self.endpoint(false, Some(key))?.into(),
            body: None,
            response_limit: 64 * 1024,
            timeout: MAX_OPERATION_DURATION,
        })?;
        match response.status {
            204 | 404 => Ok(()),
            status => Err(Error::internal(ProviderFailure {
                operation: "delete object",
                status,
            })),
        }
    }

    /// Lists beneath `<prefix>/sha256/` and strips exactly `<prefix>/` from each
    /// name; a name outside that boundary is ignored, so `pr-1/` never accepts
    /// `pr-10/`. Never strip with a global replacement or infer the prefix from
    /// an object response.
    fn list(&self, cursor: Option<&str>, limit: u32) -> Result<ObjectPage> {
        let mut url = self.endpoint(false, None)?;
        url.query_pairs_mut()
            .append_pair("prefix", &self.object_name("sha256/"))
            .append_pair("maxResults", &limit.clamp(1, 1000).to_string())
            .append_pair("fields", "items(name,timeCreated),nextPageToken");
        if let Some(cursor) = cursor {
            url.query_pairs_mut().append_pair("pageToken", cursor);
        }
        let response = self.http.execute(Request {
            method: Method::GET,
            url: url.into(),
            body: None,
            response_limit: 1024 * 1024,
            timeout: MAX_OPERATION_DURATION,
        })?;
        if response.status != 200 {
            return Err(Error::internal(ProviderFailure {
                operation: "list objects",
                status: response.status,
            }));
        }
        let listing: Listing =
            serde_json::from_slice(&response.body).context("decode GCS object listing")?;
        let prefix = self.object_name("");
        let items = listing
            .items
            .into_iter()
            .filter_map(|object| {
                Some(StoredObject {
                    key: BlobKey::from_object_name(object.name.strip_prefix(&prefix)?)?,
                    created_at: object.time_created,
                })
            })
            .collect();
        Ok(ObjectPage {
            items,
            next_cursor: listing.next_page_token,
        })
    }
}
