//! Record only answered build requests, using the database's atomic ranking.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use axum::extract::Request;
use axum::http::{StatusCode, header};
use axum::response::Response;
use mkc_domain::ids::ProjectId;
use mkc_store_interface::build_state::UploadOutcome;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::operation::Operation;
use crate::upload::StreamingUpload;
use crate::upload_error::UploadError;

/// A transient bearer used only to hash an answered request; never formatted.
pub(crate) struct AnswerGrant {
    project: ProjectId,
    bearer: String,
    pub(crate) transport: Arc<dyn UploadTransport>,
}

/// Request-local reception state; authorization and ranked outcomes remain in Postgres.
pub(crate) trait UploadTransport: Send + Sync {
    fn abandoned(&self);
    fn was_abandoned(&self) -> bool;
}

#[derive(Default)]
struct RequestTransport(AtomicBool);

impl UploadTransport for RequestTransport {
    fn abandoned(&self) {
        self.0.store(true, Ordering::SeqCst);
    }
    fn was_abandoned(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

impl AnswerGrant {
    pub(crate) fn from_request(
        params: &HashMap<String, String>,
        request: &Request,
    ) -> Option<Self> {
        if request
            .headers()
            .get_all(header::AUTHORIZATION)
            .iter()
            .count()
            != 1
        {
            return None;
        }
        let bearer = request
            .headers()
            .get(header::AUTHORIZATION)?
            .to_str()
            .ok()?
            .strip_prefix("Bearer ")?;
        if !bearer.starts_with("mkb_") {
            return None;
        }
        Some(Self {
            project: ProjectId(params.get("projectId")?.parse().ok()?),
            bearer: bearer.to_owned(),
            transport: Arc::new(RequestTransport::default()),
        })
    }
}

pub(crate) trait AnswerOutcome {
    async fn answer(
        &self,
        grant: Option<AnswerGrant>,
        operation: Operation,
        result: Result<Response>,
    ) -> Result<Response>;
}

impl AnswerOutcome for StreamingUpload {
    async fn answer(
        &self,
        grant: Option<AnswerGrant>,
        operation: Operation,
        result: Result<Response>,
    ) -> Result<Response> {
        if let Some(grant) = grant
            && !grant.transport.was_abandoned()
            && let Some(outcome) = outcome(operation, &result)
        {
            let ingest = self.ingest.clone();
            match tokio::task::spawn_blocking(move || {
                ingest.record_upload_outcome(grant.project, &grant.bearer, outcome)
            })
            .await
            .context("join answered upload outcome")?
            {
                Ok(()) => {}
                Err(error) => return Err(ApiError::publication(error)),
            }
        }
        result
    }
}

fn outcome(operation: Operation, result: &Result<Response>) -> Option<UploadOutcome> {
    match result {
        Ok(response)
            if operation == Operation::CompletePublicationUpload
                && matches!(response.status(), StatusCode::OK | StatusCode::CREATED) =>
        {
            Some(UploadOutcome::Accepted)
        }
        Ok(_) | Err(ApiError::Upload(UploadError::Unauthorized)) => None,
        Err(ApiError::Upload(UploadError::PlanRequired)) => Some(UploadOutcome::PlanRequired),
        Err(
            ApiError::NotFound
            | ApiError::Upload(
                UploadError::InvalidBundle
                | UploadError::UnsupportedVersion
                | UploadError::TooLarge
                | UploadError::BlobMismatch
                | UploadError::UnknownBlob
                | UploadError::Forbidden,
            ),
        ) => Some(UploadOutcome::Rejected),
        Err(_) => Some(UploadOutcome::Unavailable),
    }
}
