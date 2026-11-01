//! Each response reads one shared verified file at its own explicit byte offset.

use std::io::{self, ErrorKind};
#[cfg(unix)]
use std::os::unix::fs::FileExt;
#[cfg(windows)]
use std::os::windows::fs::FileExt;
use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;

use crate::asset_streams::SharedAsset;
use crate::response;

trait AssetChunks: Send + Sync {
    fn read(&self, offset: u64) -> io::Result<Vec<u8>>;
}

pub(crate) fn stream(asset: SharedAsset) -> Response {
    let mut response = response::bytes(StatusCode::OK, &asset.opened.content_type, Bytes::new());
    if let Ok(value) = HeaderValue::from_str(&asset.opened.length.to_string()) {
        response.headers_mut().insert("content-length", value);
    }
    let length = asset.opened.length;
    let reader: Arc<dyn AssetChunks> = Arc::new(asset);
    let chunks = async_stream::stream! {
        let mut offset = 0;
        while offset < length {
            let reader = reader.clone();
            let result = match tokio::task::spawn_blocking(move || reader.read(offset)).await {
                Ok(result) => result,
                Err(source) => Err(io::Error::other(source)),
            };
            match result {
                Ok(buffer) if buffer.is_empty() => break,
                Ok(buffer) => {
                    offset += buffer.len() as u64;
                    yield Ok::<_, io::Error>(Bytes::from(buffer));
                }
                Err(error) => { yield Err(error); break; }
            }
        }
    };
    *response.body_mut() = Body::from_stream(chunks);
    response
}

impl AssetChunks for SharedAsset {
    fn read(&self, offset: u64) -> io::Result<Vec<u8>> {
        let mut buffer = vec![0; (self.opened.length - offset).min(64 * 1024) as usize];
        loop {
            #[cfg(unix)]
            let result = self.opened.file.read_at(&mut buffer, offset);
            #[cfg(windows)]
            let result = self.opened.file.seek_read(&mut buffer, offset);
            match result {
                Ok(length) => {
                    buffer.truncate(length);
                    return Ok(buffer);
                }
                Err(error) if error.kind() == ErrorKind::Interrupted => continue,
                Err(error) => return Err(error),
            }
        }
    }
}
