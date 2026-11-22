//! Each response reads one shared verified file at its own explicit byte offset.

use std::io::{self, ErrorKind, Read};
use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;

use crate::asset_streams::{AtOffset, SharedAsset};
use crate::{json_delivery, response, validator};

trait AssetChunks: Send + Sync {
    fn read(&self, offset: u64) -> io::Result<Vec<u8>>;
}

/// Revalidate a captured asset or stream its bytes from independent offsets.
pub(crate) async fn deliver(mut asset: SharedAsset, headers: &HeaderMap) -> Response {
    let json = response::is_json(&asset.version.opened.content_type);
    let mut encoded = false;
    if json
        && json_delivery::accepts_gzip(headers)
        && let Some(gzip) = asset.version.gzip().await
    {
        asset.version = gzip;
        encoded = true;
    }
    let mut response = validator::deliver(headers, asset.version.etag.clone(), || {
        let mut response = stream(asset);
        if encoded {
            json_delivery::mark_gzip(&mut response);
        }
        response
    });
    if json {
        json_delivery::vary(&mut response);
    }
    response
}

fn stream(asset: SharedAsset) -> Response {
    let opened = &asset.version.opened;
    let mut response = response::bytes(StatusCode::OK, &opened.content_type, Bytes::new());
    let length = opened.length;
    response
        .headers_mut()
        .insert("content-length", HeaderValue::from(length));
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
        let opened = &self.version.opened;
        let mut buffer = vec![0; (opened.length - offset).min(64 * 1024) as usize];
        let mut reader = AtOffset::new(opened, offset);
        loop {
            match reader.read(&mut buffer) {
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
