//! Each answered build request keeps its typed outcome mapping.

use std::sync::Arc;

use axum::body::Body;
use axum::http::StatusCode;
use mkc_mokly_contract::error::{ArtifactKind, Limit, Rejection};
use mkc_publications::error::Error;
use mkc_publications::ingest::IngestMock;
use mkc_store_interface::build_state::UploadOutcome;
use unimock::{MockFn, Unimock, matching};

use crate::operation::Operation;

use super::super::{reason, send, upload};
use super::support::{BEARER, authorization, recorded, request, route_params};

/// One typed service refusal and its HTTP and grant outcomes.
type OutcomeCase = (fn() -> Error, StatusCode, &'static str, UploadOutcome);

#[tokio::test]
async fn every_typed_service_rejection_records_its_build_outcome_on_each_route() {
    let cases: &[OutcomeCase] = &[
        (
            || Error::UnsupportedVersion {
                artifact: ArtifactKind::Inventory,
                version: Some(99),
            },
            StatusCode::UPGRADE_REQUIRED,
            "upload-unsupported-version",
            UploadOutcome::Rejected,
        ),
        (
            || Error::InvalidBundle {
                reason: Rejection::Tar,
            },
            StatusCode::BAD_REQUEST,
            "upload-invalid-bundle",
            UploadOutcome::Rejected,
        ),
        (
            || Error::TooLarge {
                limit: Limit::Compressed,
            },
            StatusCode::PAYLOAD_TOO_LARGE,
            "upload-too-large",
            UploadOutcome::Rejected,
        ),
        (
            || Error::BlobMismatch,
            StatusCode::BAD_REQUEST,
            "upload-blob-mismatch",
            UploadOutcome::Rejected,
        ),
        (
            || Error::UnknownBlob,
            StatusCode::NOT_FOUND,
            "upload-unknown-blob",
            UploadOutcome::Rejected,
        ),
        (
            || Error::NotFound,
            StatusCode::NOT_FOUND,
            "not-found",
            UploadOutcome::Rejected,
        ),
        (
            || Error::Incomplete,
            StatusCode::CONFLICT,
            "upload-incomplete",
            UploadOutcome::Unavailable,
        ),
        (
            || Error::Expired,
            StatusCode::GONE,
            "upload-expired",
            UploadOutcome::Unavailable,
        ),
        (
            || Error::Unavailable,
            StatusCode::SERVICE_UNAVAILABLE,
            "upload-unavailable",
            UploadOutcome::Unavailable,
        ),
        (
            || Error::internal(Error::Unavailable),
            StatusCode::INTERNAL_SERVER_ERROR,
            "upload-failed",
            UploadOutcome::Unavailable,
        ),
    ];
    for operation in [
        Operation::UploadPublication,
        Operation::UploadPublicationBlob,
        Operation::CompletePublicationUpload,
    ] {
        for &(error, status, label, outcome) in cases {
            let ingest = match operation {
                Operation::UploadPublication => Unimock::new((
                    IngestMock::authorize
                        .next_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(authorization())),
                    IngestMock::preflight
                        .next_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, _, _| Err(error()))),
                    recorded(outcome),
                )),
                Operation::UploadPublicationBlob => Unimock::new((
                    IngestMock::authorize
                        .next_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(authorization())),
                    IngestMock::blob_target
                        .next_call(matching!(_, _, _))
                        .answers_arc(Arc::new(move |_, _, _, _| Err(error()))),
                    recorded(outcome),
                )),
                _ => Unimock::new((
                    IngestMock::authorize_completion
                        .next_call(matching!(_, _, _))
                        .answers(&|_, _, _, _| Ok(authorization())),
                    IngestMock::complete
                        .next_call(matching!(_, _))
                        .answers_arc(Arc::new(move |_, _, _| Err(error()))),
                    recorded(outcome),
                )),
            };
            let mut request = request(Body::empty());
            if operation == Operation::UploadPublicationBlob {
                request
                    .headers_mut()
                    .insert("content-type", "application/octet-stream".parse().unwrap());
                request
                    .headers_mut()
                    .insert("content-length", "0".parse().unwrap());
            }
            let (actual, body) = send(
                &upload(ingest, Unimock::new(())),
                operation,
                route_params(),
                request,
            )
            .await;
            assert_eq!(actual, status);
            assert_eq!(reason(&body), label);
            assert!(!body.to_string().contains(BEARER));
        }
    }
}
