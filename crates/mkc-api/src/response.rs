//! Successful replies and rendering through the upstream RPC error adapter.

use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use rpc_error::RpcError;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::payload::{Payload, Reply};
use crate::upload_error::UploadError;

pub(crate) fn render(result: Result<Reply>) -> Response {
    match result.and_then(success) {
        Ok(response) => response,
        Err(error) => failure(error),
    }
}

/// Renders the `rpc-error` envelope. The upload transport keeps the producer's
/// 426, 408 and 410 statuses by overriding the code's status for those three
/// reasons; every other reason uses its standard code status.
pub(crate) fn failure(error: ApiError) -> Response {
    let status = match &error {
        ApiError::Upload(UploadError::UnsupportedVersion) => Some(StatusCode::UPGRADE_REQUIRED),
        ApiError::Upload(UploadError::Timeout) => Some(StatusCode::REQUEST_TIMEOUT),
        ApiError::Upload(UploadError::Expired) => Some(StatusCode::GONE),
        _ => None,
    };
    let retry = match &error {
        ApiError::RateLimited(seconds) => HeaderValue::from_str(&seconds.to_string()).ok(),
        _ => None,
    };
    let mut response = RpcError::from(error).into_response();
    if let Some(status) = status {
        *response.status_mut() = status;
    }
    if let Some(retry) = retry {
        response.headers_mut().insert(header::RETRY_AFTER, retry);
    }
    response
}

fn success(reply: Reply) -> Result<Response> {
    let status = StatusCode::from_u16(reply.status).context("render status")?;
    let mut response = if matches!(reply.payload, Payload::Empty) {
        status.into_response()
    } else {
        (status, Json(reply.payload)).into_response()
    };
    if let Some(cookie) = reply.cookie {
        response.headers_mut().insert(
            header::SET_COOKIE,
            HeaderValue::from_str(&cookie).context("render session cookie")?,
        );
    }
    Ok(response)
}
