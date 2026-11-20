//! Blob PUTs: verify raw or gzip bodies within the upload byte budget.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::Request;
use axum::http::request::Parts;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use http_body_util::BodyExt;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_upload_memory_interface::budget::UploadMemoryReservation;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::upload::{StreamingUpload, UploadRequest, uuid};
use crate::upload_blob_decode;
use crate::upload_error::UploadError;
use crate::upload_outcome::UploadTransport;

/// Largest blob body, the regular-file ceiling.
pub(crate) const BLOB_LIMIT: u64 = 64 * 1024 * 1024;
/// Body reception bound shared with plan requests.
pub(crate) const RECEPTION: Duration = Duration::from_secs(120);

#[derive(Clone, Copy, PartialEq, Eq)]
enum BlobEncoding {
    Raw,
    Gzip,
}

struct BlobHeaders {
    encoding: BlobEncoding,
    length: u64,
}

/// Buffered body bytes that keep their memory reservation for every clone.
struct ReservedBody {
    bytes: Vec<u8>,
    _reservation: Arc<dyn UploadMemoryReservation>,
}

impl AsRef<[u8]> for ReservedBody {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}

pub(crate) trait BlobReceiver {
    async fn blob(&self, params: HashMap<String, String>, request: Request) -> Result<Response>;
}

impl BlobReceiver for StreamingUpload {
    async fn blob(&self, params: HashMap<String, String>, request: Request) -> Result<Response> {
        let project = ProjectId(uuid(&params, "projectId", || {
            ApiError::Upload(UploadError::InvalidBundle)
        })?);
        let (parts, body) = request.into_parts();
        let transport = parts.extensions.get::<Arc<dyn UploadTransport>>().cloned();
        let authorization = self.authorize(project, &parts, None).await?;
        let headers = declared_headers(&parts)?;
        let upload = PublicationId(uuid(&params, "publicationId", || ApiError::NotFound)?);
        let hash = params
            .get("sha256")
            .and_then(|value| value.parse::<BlobHash>().ok());
        let ingest = self.ingest.clone();
        let target = match tokio::task::spawn_blocking(move || {
            ingest.blob_target(&authorization, upload, hash.as_ref())
        })
        .await
        .context("join blob reservation lookup")?
        {
            Ok(target) => target,
            Err(error) => return Err(ApiError::publication(error)),
        };
        if headers.encoding == BlobEncoding::Gzip && headers.length > target.size {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        if headers.encoding == BlobEncoding::Raw && headers.length != target.size {
            return Err(ApiError::Upload(UploadError::BlobMismatch));
        }
        if target.durable {
            drain(body, transport).await?;
            return Ok(StatusCode::NO_CONTENT.into_response());
        }
        let encoded_reservation = match headers.encoding {
            BlobEncoding::Gzip => Some(
                self.memory
                    .reserve(headers.length)
                    .map_err(|_| ApiError::Upload(UploadError::Unavailable))?,
            ),
            BlobEncoding::Raw => None,
        };
        let decoded_reservation = match self.memory.reserve(target.size) {
            Ok(reservation) => reservation,
            Err(_) => return Err(ApiError::Upload(UploadError::Unavailable)),
        };
        let bytes = match headers.encoding {
            BlobEncoding::Raw => {
                match tokio::time::timeout(RECEPTION, read(body, headers.length, transport)).await {
                    Ok(result) => result?,
                    Err(_) => return Err(ApiError::Upload(UploadError::Timeout)),
                }
            }
            BlobEncoding::Gzip => {
                let Some(encoded_reservation) = encoded_reservation else {
                    return Err(ApiError::Upload(UploadError::InvalidBundle));
                };
                upload_blob_decode::receive(
                    body,
                    headers.length,
                    target.size,
                    encoded_reservation,
                    transport,
                )
                .await?
            }
        };
        let bytes = Bytes::from_owner(ReservedBody {
            bytes,
            _reservation: decoded_reservation,
        });
        let ingest = self.ingest.clone();
        match tokio::task::spawn_blocking(move || ingest.store_blob(&target, bytes))
            .await
            .context("join blob storage")?
        {
            Ok(()) => Ok(StatusCode::NO_CONTENT.into_response()),
            Err(error) => Err(ApiError::publication(error)),
        }
    }
}

/// The required Blob headers, before any body byte is read.
fn declared_headers(parts: &Parts) -> Result<BlobHeaders> {
    if parts
        .headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        != Some("application/octet-stream")
        || parts.uri.query().is_some()
    {
        return Err(ApiError::Upload(UploadError::InvalidBundle));
    }
    let encoding = match parts.headers.get(header::CONTENT_ENCODING) {
        None => BlobEncoding::Raw,
        Some(value) if value.to_str().ok() == Some("gzip") => BlobEncoding::Gzip,
        Some(_) => return Err(ApiError::Upload(UploadError::InvalidBundle)),
    };
    let length = parts
        .headers
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or(ApiError::Upload(UploadError::InvalidBundle))?;
    if encoding == BlobEncoding::Raw && length > BLOB_LIMIT {
        return Err(ApiError::Upload(UploadError::TooLarge));
    }
    Ok(BlobHeaders { encoding, length })
}

/// Read exactly the declared length; anything else is an invalid body.
async fn read(
    mut body: Body,
    length: u64,
    transport: Option<Arc<dyn UploadTransport>>,
) -> Result<Vec<u8>> {
    let capacity = usize::try_from(length).context("size blob body")?;
    let mut bytes = Vec::with_capacity(capacity);
    while let Some(frame) = body.frame().await {
        let Ok(frame) = frame else {
            if let Some(transport) = transport {
                transport.abandoned();
            }
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        };
        if let Ok(data) = frame.into_data() {
            if bytes.len() + data.len() > capacity {
                return Err(ApiError::Upload(UploadError::InvalidBundle));
            }
            bytes.extend_from_slice(&data);
        }
    }
    if bytes.len() != capacity {
        return Err(ApiError::Upload(UploadError::InvalidBundle));
    }
    Ok(bytes)
}

/// Consume a body whose content the project already stored, without buffering it.
async fn drain(mut body: Body, transport: Option<Arc<dyn UploadTransport>>) -> Result<()> {
    let drained = tokio::time::timeout(RECEPTION, async move {
        while let Some(frame) = body.frame().await {
            if frame.is_err() {
                if let Some(transport) = transport {
                    transport.abandoned();
                }
                return Err(ApiError::Upload(UploadError::InvalidBundle));
            }
        }
        Ok(())
    })
    .await;
    match drained {
        Ok(result) => result,
        Err(_) => Err(ApiError::Upload(UploadError::Timeout)),
    }
}
