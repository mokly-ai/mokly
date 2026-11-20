//! Plan requests: stream the artifact archive into preflight and answer with the plan.

use std::collections::HashMap;
use std::io::Cursor;
use std::sync::Arc;
use std::time::Duration;

use axum::Json;
use axum::extract::Request;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use bytes::Bytes;
use chrono::SecondsFormat;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::ProjectId;
use mkc_publications::ingest::Plan;
use serde::Serialize;
use tokio::sync::mpsc;
use utoipa::ToSchema;

use crate::contract::scalars::{missing_blobs, upload_version};
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::upload::{StreamingUpload, UploadRequest, uuid};
use crate::upload_error::UploadError;
use crate::upload_outcome::UploadTransport;
use crate::upload_stream::{BodyPump, COMPRESSED_LIMIT, ChannelReader};

/// The released plan response, version 1.
#[derive(Debug, PartialEq, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = UploadPlan)]
pub(crate) struct PlanResponse {
    #[schema(schema_with = upload_version)]
    pub(crate) schema_version: u8,
    #[schema(inline)]
    pub(crate) upload: PlanUpload,
    /// Declared file hashes this project has not stored, in ascending order.
    #[schema(schema_with = missing_blobs)]
    pub(crate) missing: Vec<BlobHash>,
    /// Blob upload URL on the API origin; its final path segment is the literal {sha256}
    /// placeholder.
    pub(crate) blob_url: String,
    /// Completion URL on the API origin.
    #[schema(format = "uri")]
    pub(crate) complete_url: String,
    /// Encodings that Blob URLs may receive, omitted when only raw bytes are enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(nullable = false)]
    pub(crate) blob_encodings: Option<Vec<BlobEncoding>>,
}

/// An encoding supported for an individual Blob request.
#[derive(Debug, PartialEq, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum BlobEncoding {
    /// The request body is one gzip member.
    Gzip,
}

/// The attempt id and its deadline with exactly three fractional digits.
#[derive(Debug, PartialEq, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PlanUpload {
    /// Upload attempt ID, which becomes the publication ID when it is ready.
    #[schema(format = Uuid)]
    pub(crate) id: String,
    /// UTC attempt deadline with exactly three fractional digits.
    #[schema(format = DateTime)]
    pub(crate) expires_at: String,
}

/// Render a plan on the API's own origin; `{sha256}` stays a literal placeholder.
pub(crate) fn plan_response(api_origin: &str, plan: Plan, advertise_gzip: bool) -> PlanResponse {
    let base = format!(
        "{}/v1/projects/{}/publication-uploads/{}",
        api_origin.trim_end_matches('/'),
        plan.project.0,
        plan.upload.0
    );
    PlanResponse {
        schema_version: 1,
        upload: PlanUpload {
            id: plan.upload.0.to_string(),
            expires_at: plan.expires_at.to_rfc3339_opts(SecondsFormat::Millis, true),
        },
        missing: plan.missing,
        blob_url: format!("{base}/blobs/{{sha256}}"),
        complete_url: format!("{base}/complete"),
        blob_encodings: advertise_gzip.then(|| vec![BlobEncoding::Gzip]),
    }
}

pub(crate) trait PlanReceiver {
    async fn plan(&self, params: HashMap<String, String>, request: Request) -> Result<Response>;
}

impl PlanReceiver for StreamingUpload {
    async fn plan(&self, params: HashMap<String, String>, request: Request) -> Result<Response> {
        let project = ProjectId(uuid(&params, "projectId", || {
            ApiError::Upload(UploadError::InvalidBundle)
        })?);
        let (parts, body) = request.into_parts();
        let transport = parts.extensions.get::<Arc<dyn UploadTransport>>().cloned();
        let authorization = self.authorize(project, &parts, None).await?;
        if parts
            .headers
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            != Some("application/gzip")
            || parts.headers.contains_key(header::CONTENT_ENCODING)
            || parts.uri.query().is_some()
        {
            return Err(ApiError::Upload(UploadError::InvalidBundle));
        }
        if let Some(length) = parts.headers.get(header::CONTENT_LENGTH) {
            let length = length
                .to_str()
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .ok_or(ApiError::Upload(UploadError::InvalidBundle))?;
            if length > COMPRESSED_LIMIT as u64 {
                return Err(ApiError::Upload(UploadError::TooLarge));
            }
        }
        let permit = self
            .admission
            .clone()
            .try_acquire_owned()
            .ok()
            .ok_or(ApiError::Upload(UploadError::Unavailable))?;
        let (sender, receiver) = mpsc::channel(2);
        let ingest = self.ingest.clone();
        let mut worker = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            ingest.preflight(
                authorization,
                &mut ChannelReader {
                    receiver,
                    current: Cursor::new(Bytes::new()),
                    complete: false,
                },
            )
        });
        let result = tokio::select! {
            result = &mut worker => result.context("join publication plan worker")?,
            result = tokio::time::timeout(Duration::from_secs(120), body.pump(sender, transport)) => {
                match result {
                    Ok(Ok(())) => (),
                    Ok(Err(error)) => return Err(error),
                    Err(_) => return Err(ApiError::Upload(UploadError::Timeout)),
                }
                worker.await.context("finish publication plan worker")?
            }
        };
        let plan = match result {
            Ok(value) => value,
            Err(error) => return Err(ApiError::publication(error)),
        };
        Ok((
            StatusCode::OK,
            Json(plan_response(&self.api_origin, plan, self.blob_gzip)),
        )
            .into_response())
    }
}
