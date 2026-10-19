//! Verified temporary files keep mutable source bytes out of HTTP responses.

use std::io::Seek;

use mokly_graph::asset_delivery::AssetRead;

use crate::error::{InternalError, Result, ServerError};
use crate::public_read::OpenedFile;

/// Private response capture before headers or bytes reach the browser.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = AssetStreamsMock))]
pub trait AssetStreams: Send + Sync {
    /// Verify one generation's stream, then return a stable file positioned at its start.
    fn capture(&self, asset: &mut dyn AssetRead, content_type: &str) -> Result<OpenedFile>;
}

/// Unnamed temporary storage is released when the response closes.
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
