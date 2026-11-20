//! Completion requests: an empty body, resolved by the ingest service into a receipt.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::Request;
use axum::http::header;
use axum::response::Response;
use http_body_util::BodyExt;
use mkc_domain::ids::{ProjectId, PublicationId};

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::upload::{StreamingUpload, UploadRequest, uuid};
use crate::upload_error::UploadError;
use crate::upload_outcome::UploadTransport;

pub(crate) trait CompletionReceiver {
    async fn completion(
        &self,
        params: HashMap<String, String>,
        request: Request,
    ) -> Result<Response>;
}

impl CompletionReceiver for StreamingUpload {
    async fn completion(
        &self,
        params: HashMap<String, String>,
        request: Request,
    ) -> Result<Response> {
        let project = ProjectId(uuid(&params, "projectId", || {
            ApiError::Upload(UploadError::InvalidBundle)
        })?);
        let (parts, mut body) = request.into_parts();
        let completion = params
            .get("publicationId")
            .and_then(|value| value.parse().ok())
            .map(PublicationId);
        let authorization = self.authorize(project, &parts, completion).await?;
        let declared = parts
            .headers
            .get(header::CONTENT_LENGTH)
            .and_then(|value| value.to_str().ok());
        if declared.is_some_and(|value| value != "0") || parts.uri.query().is_some() {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        while let Some(frame) = body.frame().await {
            match frame {
                Ok(frame) if frame.data_ref().is_none_or(|bytes| bytes.is_empty()) => {}
                Ok(_) => return Err(ApiError::Upload(UploadError::InvalidBundle)),
                Err(_) => {
                    if let Some(transport) = parts.extensions.get::<Arc<dyn UploadTransport>>() {
                        transport.abandoned();
                    }
                    return Err(ApiError::Upload(UploadError::InvalidBundle));
                }
            }
        }
        let upload = PublicationId(uuid(&params, "publicationId", || ApiError::NotFound)?);
        let ingest = self.ingest.clone();
        let ingested =
            match tokio::task::spawn_blocking(move || ingest.complete(authorization, upload))
                .await
                .context("join upload completion")?
            {
                Ok(value) => value,
                Err(error) => return Err(ApiError::publication(error)),
            };
        self.receipt(ingested)
    }
}
