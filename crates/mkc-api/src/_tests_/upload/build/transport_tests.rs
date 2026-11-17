//! An interrupted body cannot overwrite an answered sibling's upload outcome.

use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};

use axum::body::{Body, Bytes};
use axum::http::StatusCode;
use chrono::Utc;
use http_body::Frame;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_publications::error::Error;
use mkc_publications::ingest::{BlobTarget, IngestMock};
use mkc_store_interface::build_state::UploadOutcome;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::ApiError;
use crate::operation::Operation;
use crate::upload_error::UploadError;
use crate::upload_outcome::{AnswerGrant, AnswerOutcome};

use super::super::{PROJECT, reason, send, upload};
use super::support::{authorization, recorded, request, route_params};

struct BrokenBody;

impl http_body::Body for BrokenBody {
    type Data = Bytes;
    type Error = io::Error;
    fn poll_frame(
        self: Pin<&mut Self>,
        _: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, io::Error>>> {
        Poll::Ready(Some(Err(io::Error::new(
            io::ErrorKind::ConnectionReset,
            "disconnected test body",
        ))))
    }
}

#[tokio::test]
async fn a_disconnected_body_records_nothing_on_all_three_routes() {
    for operation in [
        Operation::UploadPublication,
        Operation::UploadPublicationBlob,
        Operation::CompletePublicationUpload,
    ] {
        let ingest = match operation {
            Operation::UploadPublication => Unimock::new((
                IngestMock::authorize
                    .next_call(matching!(_, _))
                    .answers(&|_, _, _| Ok(authorization())),
                IngestMock::preflight
                    .next_call(matching!(_, _))
                    .answers(&|_, _, body| {
                        assert!(body.read(&mut [0; 1]).is_err());
                        Err(Error::InvalidBundle {
                            reason: mkc_mokly_contract::error::Rejection::Gzip,
                        })
                    }),
            )),
            Operation::UploadPublicationBlob => Unimock::new((
                IngestMock::authorize
                    .next_call(matching!(_, _))
                    .answers(&|_, _, _| Ok(authorization())),
                IngestMock::blob_target
                    .next_call(matching!(_, _, _))
                    .returns(Ok(BlobTarget {
                        project: PROJECT,
                        key: BlobKey {
                            hash: BlobHash::digest(b""),
                            incarnation: Uuid::from_u128(4),
                        },
                        size: 0,
                        durable: true,
                        deadline: Utc::now(),
                    })),
            )),
            _ => Unimock::new(
                IngestMock::authorize_completion
                    .next_call(matching!(_, _, _))
                    .answers(&|_, _, _, _| Ok(authorization())),
            ),
        };
        let mut request = request(Body::new(BrokenBody));
        if operation == Operation::UploadPublicationBlob {
            request
                .headers_mut()
                .insert("content-type", "application/octet-stream".parse().unwrap());
            request
                .headers_mut()
                .insert("content-length", "0".parse().unwrap());
        }
        let (status, body) = send(
            &upload(ingest, Unimock::new(())),
            operation,
            route_params(),
            request,
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(reason(&body), "upload-invalid-bundle");
    }
}

#[tokio::test]
async fn an_answered_reception_timeout_records_unavailable() {
    for operation in [
        Operation::UploadPublication,
        Operation::UploadPublicationBlob,
    ] {
        let handler = upload(
            Unimock::new(recorded(UploadOutcome::Unavailable)),
            Unimock::new(()),
        );
        let grant = AnswerGrant::from_request(&route_params(), &request(Body::empty()));
        let result = handler
            .answer(
                grant,
                operation,
                Err(ApiError::Upload(UploadError::Timeout)),
            )
            .await;
        assert!(matches!(
            result,
            Err(ApiError::Upload(UploadError::Timeout))
        ));
    }
}
