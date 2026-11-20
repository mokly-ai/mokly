//! No build refusal reads bytes or discloses a credential.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::StatusCode;
use mkc_publications::error::Error;
use mkc_store_interface::build_state::UploadOutcome;
use unimock::Unimock;

use crate::operation::Operation;

use super::super::{reason, send, upload};
use super::support::{BEARER, Logs, UnreadBody, denied, request, route_params};

#[tokio::test]
async fn every_build_authorization_refusal_precedes_body_reads_and_keeps_tokens_private() {
    let logs = Logs(Arc::new(Mutex::new(Vec::new())));
    let subscriber = tracing_subscriber::fmt()
        .with_ansi(false)
        .without_time()
        .with_writer(logs.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);
    for operation in [
        Operation::UploadPublication,
        Operation::UploadPublicationBlob,
        Operation::CompletePublicationUpload,
    ] {
        for (error, status, label, outcome) in [
            (
                (|| Error::Unauthorized) as fn() -> Error,
                StatusCode::UNAUTHORIZED,
                "upload-unauthorized",
                None,
            ),
            (
                (|| Error::Forbidden) as fn() -> Error,
                StatusCode::FORBIDDEN,
                "upload-forbidden",
                Some(UploadOutcome::Rejected),
            ),
            (
                (|| Error::PlanRequired) as fn() -> Error,
                StatusCode::FORBIDDEN,
                "upload-plan-required",
                Some(UploadOutcome::PlanRequired),
            ),
        ] {
            tracing::warn!(error = ?error(), "typed upload rejection");
            assert!(!format!("{:?} {}", error(), error()).contains(BEARER));
            let ingest = denied(operation, error, outcome);
            let polls = Arc::new(AtomicUsize::new(0));
            let (actual, body) = send(
                &upload(ingest, Unimock::new(())),
                operation,
                route_params(),
                request(Body::new(UnreadBody(polls.clone()))),
            )
            .await;
            assert_eq!(actual, status);
            assert_eq!(reason(&body), label);
            assert_eq!(polls.load(Ordering::SeqCst), 0);
            assert!(!body.to_string().contains(BEARER));
        }
    }
    let output = String::from_utf8(logs.0.lock().unwrap().clone()).unwrap();
    assert!(!output.is_empty());
    assert!(!output.contains(BEARER));
}
