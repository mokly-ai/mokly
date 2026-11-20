//! Bearer-authenticated publication upload routes, isolated from JSON command dispatch.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use axum::Json;
use axum::extract::Request;
use axum::http::request::Parts;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_publications::ingest::{Ingest, Ingested, UploadAuthorization};
use mkc_publications::locations::Locations;
use mkc_upload_memory_interface::budget::UploadMemoryBudget;
use serde::Serialize;
use tokio::sync::Semaphore;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::contract::scalars::receipt_state;
use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::operation::Operation;
use crate::response;
use crate::upload_blob::BlobReceiver;
use crate::upload_complete::CompletionReceiver;
use crate::upload_error::UploadError;
use crate::upload_outcome::{AnswerGrant, AnswerOutcome};
use crate::upload_plan::PlanReceiver;
use crate::viewer::publication_state::PublicationStateView;

#[cfg_attr(test, unimock::unimock(api = [UploadHandlerMock]))]
pub(crate) trait UploadHandler: Send + Sync {
    fn handle(
        &self,
        operation: Operation,
        params: HashMap<String, String>,
        request: Request,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

/// Plan, blob and completion handlers sharing one ingest service.
pub(crate) struct StreamingUpload {
    pub(crate) ingest: Arc<dyn Ingest>,
    pub(crate) locations: Locations,
    /// Exact public API origin that starts plan URLs.
    pub(crate) api_origin: String,
    /// Concurrent plan archives per process.
    pub(crate) admission: Arc<Semaphore>,
    /// Process-wide byte budget shared with plan archives.
    pub(crate) memory: Arc<dyn UploadMemoryBudget>,
    /// Whether Plan responses advertise gzip Blob bodies.
    pub(crate) blob_gzip: bool,
}

/// The existing receipt: the publication's persisted state and its addresses.
#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Receipt {
    #[schema(inline, format = Uuid)]
    id: PublicationId,
    #[schema(inline, format = Uuid)]
    project_id: ProjectId,
    #[schema(required, value_type = Option<Uuid>)]
    build_id: Option<BuildId>,
    #[schema(schema_with = receipt_state)]
    state: PublicationStateView,
    #[schema(format = "uri")]
    catalogue_url: String,
    #[schema(format = "uri")]
    viewer_url: String,
}

impl UploadHandler for StreamingUpload {
    fn handle(
        &self,
        operation: Operation,
        params: HashMap<String, String>,
        mut request: Request,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async move {
            let grant = AnswerGrant::from_request(&params, &request);
            if let Some(grant) = &grant {
                request.extensions_mut().insert(grant.transport.clone());
            }
            let result = match operation {
                Operation::UploadPublicationBlob => self.blob(params, request).await,
                Operation::CompletePublicationUpload => self.completion(params, request).await,
                _ => self.plan(params, request).await,
            };
            match self.answer(grant, operation, result).await {
                Ok(response) => response,
                Err(error) => response::failure(error),
            }
        })
    }
}

/// Shared request steps for every upload route.
pub(crate) trait UploadRequest {
    async fn authorize(
        &self,
        project: ProjectId,
        parts: &Parts,
        completion: Option<PublicationId>,
    ) -> Result<UploadAuthorization>;
    fn receipt(&self, ingested: Ingested) -> Result<Response>;
}

impl UploadRequest for StreamingUpload {
    /// Exactly one `Bearer` header, checked before any body byte is read.
    async fn authorize(
        &self,
        project: ProjectId,
        parts: &Parts,
        completion: Option<PublicationId>,
    ) -> Result<UploadAuthorization> {
        if parts.headers.get_all(header::AUTHORIZATION).iter().count() != 1 {
            return Err(ApiError::Upload(UploadError::Unauthorized));
        }
        let bearer = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or(ApiError::Upload(UploadError::Unauthorized))?
            .to_owned();
        let ingest = self.ingest.clone();
        match tokio::task::spawn_blocking(move || {
            if let Some(upload) = completion
                && bearer.starts_with("mkb_")
            {
                ingest.authorize_completion(project, &bearer, upload)
            } else {
                ingest.authorize(project, &bearer)
            }
        })
        .await
        .context("authenticate publication bearer")?
        {
            Ok(value) => Ok(value),
            Err(error) => Err(ApiError::publication(error)),
        }
    }

    /// 201 when this upload created the publication, otherwise 200.
    fn receipt(&self, ingested: Ingested) -> Result<Response> {
        let publication = ingested.publication;
        let viewer_url = self
            .locations
            .viewer(
                &ingested.organization_slug,
                &ingested.project_slug,
                publication.id,
                None,
            )
            .context("render publication destination")?;
        Ok((
            if ingested.replay {
                StatusCode::OK
            } else {
                StatusCode::CREATED
            },
            Json(Receipt {
                id: publication.id,
                project_id: publication.project_id,
                build_id: publication.build_id,
                state: publication.state.into(),
                catalogue_url: self.locations.catalogue(publication.id),
                viewer_url,
            }),
        )
            .into_response())
    }
}

/// A UUID path parameter, or the given error when it is absent or malformed.
pub(crate) fn uuid(
    params: &HashMap<String, String>,
    key: &str,
    error: impl FnOnce() -> ApiError,
) -> Result<Uuid> {
    params
        .get(key)
        .and_then(|value| value.parse().ok())
        .ok_or_else(error)
}

#[cfg(test)]
#[path = "_tests_/upload/mod.rs"]
mod tests;
