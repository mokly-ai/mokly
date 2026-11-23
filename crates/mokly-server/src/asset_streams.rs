//! Verified temporary files keep mutable source bytes out of HTTP responses.

use std::io::Seek;
use std::sync::{Arc, OnceLock};

use axum::http::HeaderValue;
use mokly_graph::asset_delivery::AssetRead;

use crate::authored_assets::AuthoredRecord;
use crate::error::{InternalError, Result, ServerError};
use crate::public_read::OpenedFile;

pub(crate) type CaptureResult = std::result::Result<Option<Arc<AssetVersion>>, Arc<ServerError>>;
pub(crate) type Capture = OnceLock<CaptureResult>;

/// One verified asset response, or the original failure shared by its waiters.
pub type AssetResult = std::result::Result<Option<SharedAsset>, Arc<ServerError>>;

/// A response keeps its verified file and the concurrent capture reservation alive.
#[derive(Clone)]
pub struct SharedAsset {
    /// Immutable file and HTTP validator shared without cloning the file cursor.
    pub(crate) version: Arc<AssetVersion>,
    /// Retain the generated reservation or the authored version's validator record.
    pub(crate) owner: AssetOwner,
}

/// Keep a generated capture or an authored validator record alive during delivery.
#[derive(Clone)]
pub(crate) enum AssetOwner {
    Generated { _capture: Arc<Capture> },
    Authored(Arc<AuthoredRecord>),
}

/// A gzip response either streams the capture or revalidates recorded metadata.
#[derive(Clone)]
pub(crate) enum GzipDelivery {
    File(Arc<AssetVersion>),
    Unchanged(HeaderValue),
}

/// A captured file and the strong validator of exactly its bytes.
pub(crate) struct AssetVersion {
    pub(crate) opened: OpenedFile,
    pub(crate) etag: HeaderValue,
}

impl AssetVersion {
    /// Attach the strong tag for an already checked capture.
    pub(crate) fn with_tag(opened: OpenedFile, etag: HeaderValue) -> Self {
        Self { opened, etag }
    }
}

/// A reserved asset response, captured after foreground worker admission.
pub trait AssetRequest: Send + Sync {
    /// Verify the reserved asset before returning any response headers.
    fn capture(self: Box<Self>) -> AssetResult;
}

/// Private response capture before headers or bytes reach the browser.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = AssetStreamsMock))]
pub trait AssetStreams: Send + Sync {
    /// Verify one generation's stream, then return a stable file positioned at its start.
    fn capture(&self, asset: &mut dyn AssetRead, content_type: &str) -> Result<OpenedFile>;
}

/// Unnamed temporary storage is released when its last response closes.
pub struct TemporaryAssets;

impl AssetStreams for TemporaryAssets {
    fn capture(&self, asset: &mut dyn AssetRead, content_type: &str) -> Result<OpenedFile> {
        let mut file = match tempfile::tempfile() {
            Ok(file) => file,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if let Err(source) = asset.copy_to(&mut file) {
            return Err(ServerError::Render { source });
        }
        if let Err(source) = file.rewind() {
            return Err(InternalError::Io { source }.into());
        }
        Ok(OpenedFile {
            file,
            length: asset.length(),
            content_type: content_type.into(),
        })
    }
}
