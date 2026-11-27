//! Bearer precedence and credential privacy at the HTTP boundary.

use std::io::{self, Write};
use std::str;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::http::{StatusCode, header};
use mkc_domain::values::Visibility;
use mkc_publications::access::CatalogueAccessMock;
use mkc_publications::error::Error;
use unimock::{MockFn, Unimock, matching};

use crate::test_support::{ID, authorized, indexed_catalogue, mocked_catalogue};

use super::embedded_access_support::iframe;
use super::{file_request, router, send};

fn credential_router(access: Unimock, status: StatusCode) -> Router {
    let catalogue = if status == StatusCode::OK {
        indexed_catalogue(
            access,
            [("index.html".into(), b"home".to_vec())].into(),
            false,
        )
    } else {
        mocked_catalogue(access, Unimock::new(()), Unimock::new(()))
    };
    router(catalogue)
}

#[tokio::test]
async fn verified_bearer_takes_precedence_even_when_membership_denies_access() {
    for status in [StatusCode::OK, StatusCode::NOT_FOUND] {
        let access = Unimock::new(
            CatalogueAccessMock::authorize
                .next_call(matching!(&ID, Some("signed"), _))
                .returns(if status == StatusCode::OK {
                    authorized(Visibility::Private)
                } else {
                    Err(Error::NotFound)
                }),
        );
        let router = credential_router(access, status);
        let response = send(
            &router,
            iframe(file_request("/"))
                .header(header::AUTHORIZATION, "bEaReR signed")
                .header(header::COOKIE, "__Host-mkc_catalogue=stale"),
        )
        .await;
        assert_eq!(response.status(), status);
        assert_eq!(response.headers().get(header::SET_COOKIE), None);
    }
}

#[tokio::test]
async fn invalid_bearer_falls_back_and_only_an_invalid_cookie_is_cleared() {
    for (cookie, status, expired) in [
        (Some("fresh"), StatusCode::OK, false),
        (Some("stale"), StatusCode::UNAUTHORIZED, true),
        (None, StatusCode::UNAUTHORIZED, false),
    ] {
        let access = Unimock::new((
            CatalogueAccessMock::authorize
                .next_call(matching!(&ID, Some("bad-signature"), _))
                .answers(&|_, _, _, rejected| {
                    *rejected = true;
                    Err(Error::Unauthorized)
                }),
            CatalogueAccessMock::authorize
                .next_call(matching!(&ID, _, _))
                .answers_arc(Arc::new(move |_, _, actual, clear| {
                    assert_eq!(actual, cookie);
                    *clear = expired;
                    if status == StatusCode::OK {
                        authorized(Visibility::Private)
                    } else {
                        Err(Error::Unauthorized)
                    }
                })),
        ));
        let mut request = file_request("/").header(header::AUTHORIZATION, "Bearer bad-signature");
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, format!("__Host-mkc_catalogue={cookie}"));
        }
        let router = credential_router(access, status);
        let response = send(&router, request).await;
        assert_eq!(response.status(), status, "{cookie:?}");
        assert_eq!(
            response.headers().get(header::SET_COOKIE).map(|value| value.to_str().unwrap()),
            expired.then_some("__Host-mkc_catalogue=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0; Partitioned"),
            "{cookie:?}"
        );
    }
}

#[tokio::test]
async fn malformed_or_duplicate_authorization_headers_use_the_cookie() {
    for headers in [
        &["Basic signed"][..],
        &["Bearer "],
        &["Bearer signed extra"],
        &["Bearer signed, Bearer other"],
        &["Bearer signed", "Bearer other"],
    ] {
        let access = Unimock::new(
            CatalogueAccessMock::authorize
                .next_call(matching!(&ID, Some("fresh"), _))
                .returns(authorized(Visibility::Private)),
        );
        let mut request = file_request("/").header(header::COOKIE, "__Host-mkc_catalogue=fresh");
        for value in headers {
            request = request.header(header::AUTHORIZATION, *value);
        }
        let router = credential_router(access, StatusCode::OK);
        let response = send(&router, request).await;
        assert_eq!(response.status(), StatusCode::OK, "{headers:?}");
        assert_eq!(response.headers().get(header::SET_COOKIE), None);
    }
}

struct LogWriter(Arc<Mutex<Vec<u8>>>);

impl Write for LogWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().unwrap().write(bytes)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[tokio::test]
async fn catalogue_denial_logs_exclude_the_authorization_header_and_token() {
    // Keep two dispatchers registered so any test thread can register the shared RPC error callsite.
    let _idle_dispatch = tracing::Dispatch::new(
        tracing_subscriber::fmt()
            .with_max_level(tracing::level_filters::LevelFilter::OFF)
            .finish(),
    );
    let output = Arc::new(Mutex::new(Vec::new()));
    let writer = output.clone();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::TRACE)
        .without_time()
        .with_ansi(false)
        .with_writer(move || LogWriter(writer.clone()))
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);
    let access = Unimock::new(
        CatalogueAccessMock::authorize
            .next_call(matching!(&ID, Some("sensitive-fixture-token"), _))
            .returns(Err(Error::NotFound)),
    );
    let router = credential_router(access, StatusCode::NOT_FOUND);
    let response = send(
        &router,
        file_request("/").header(header::AUTHORIZATION, "Bearer sensitive-fixture-token"),
    )
    .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let output = output.lock().unwrap();
    let logs = str::from_utf8(&output).unwrap().to_ascii_lowercase();
    assert!(logs.contains("rpc error"));
    assert!(logs.contains("status=404"));
    assert!(!logs.contains("authorization"));
    assert!(!logs.contains("sensitive-fixture-token"));
}
