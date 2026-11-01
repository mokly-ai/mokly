//! Verified temporary files keep mutable source bytes out of HTTP responses.

use std::io::Seek;
use std::sync::{Arc, OnceLock};

use mokly_graph::asset_delivery::AssetRead;

use crate::error::{InternalError, Result, ServerError};
use crate::public_read::OpenedFile;

pub(crate) type CaptureResult = std::result::Result<Option<Arc<OpenedFile>>, Arc<ServerError>>;
pub(crate) type Capture = OnceLock<CaptureResult>;

/// One verified asset response, or the original failure shared by its waiters.
pub type AssetResult = std::result::Result<Option<SharedAsset>, Arc<ServerError>>;

/// A response keeps its verified file and the concurrent capture reservation alive.
#[derive(Clone)]
pub struct SharedAsset {
    /// Verified file and metadata shared without cloning the file cursor.
    pub(crate) opened: Arc<OpenedFile>,
    /// Keep the weak route entry usable until this response ends.
    pub(crate) _capture: Arc<Capture>,
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
