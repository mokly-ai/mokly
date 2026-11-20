//! Recorded seed HTTP exchanges through the production bounded transport.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[path = "support/server.rs"]
mod server;

use std::sync::Arc;

use bytes::Bytes;
use mkc_file_store_gcs::store::GcsFileStore;
use mkc_file_store_gcs::transport::{AccessTokenMock, HttpFactory, ReqwestHttpFactory};
use mkc_file_store_interface::error::{Error, IntegrityError};
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use unimock::{MockFn, Unimock, matching};

use self::server::{exchange, server};

fn store(endpoint: String, prefix: Option<&str>) -> Arc<dyn SeedStore> {
    Arc::new(GcsFileStore::new(
        endpoint,
        "catalogue-fixture".to_owned(),
        prefix.map(|value| value.parse().unwrap()),
        ReqwestHttpFactory
            .build(Arc::new(Unimock::new(
                AccessTokenMock::token
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok("fixture-oauth".to_owned())),
            )))
            .unwrap(),
    ))
}

fn targets(namespace: &str, file: &str) -> (String, String) {
    let name = format!("{namespace}seed/local/{file}").replace('/', "%2F");
    (
        format!("/storage/v1/b/catalogue-fixture/o/{name}?alt=media"),
        format!("/upload/storage/v1/b/catalogue-fixture/o?uploadType=media&name={name}"),
    )
}

#[test]
fn seed_lifecycle_reads_and_replaces_exact_names_with_and_without_prefixes() {
    for (prefix, namespace) in [(None, ""), (Some("pr-1"), "pr-1/")] {
        let name = SeedName::new("local", "seed-status.json").unwrap();
        let (read, upload) = targets(namespace, "seed-status.json");
        let mut put = exchange("POST", &upload, 200, b"{}".to_vec())
            .expect_header("content-type", "application/octet-stream");
        put.request = b"failed status".to_vec();
        let mut replace = exchange("POST", &upload, 201, b"{}".to_vec());
        replace.request = b"seeded".to_vec();
        let (endpoint, handle) = server(vec![
            exchange(
                "GET",
                &read,
                404,
                include_bytes!("../fixtures/not-found.json").to_vec(),
            ),
            put,
            exchange("GET", &read, 200, b"failed status".to_vec())
                .response_header("Content-Length", "13"),
            replace,
            exchange("GET", &read, 200, b"seeded".to_vec()),
        ]);
        let store = store(endpoint, prefix);

        assert_eq!(store.get(&name, 64).unwrap(), None);
        store
            .put(&name, Bytes::from_static(b"failed status"))
            .unwrap();
        assert_eq!(
            store.get(&name, 64).unwrap(),
            Some(b"failed status".to_vec())
        );
        store.put(&name, Bytes::from_static(b"seeded")).unwrap();
        assert_eq!(store.get(&name, 64).unwrap(), Some(b"seeded".to_vec()));
        handle.join().unwrap();
    }
}

#[test]
fn seed_provider_failures_never_become_missing_or_success() {
    let name = SeedName::new("local", "request.json").unwrap();
    let (read, upload) = targets("pr-1/", "request.json");
    let mut put = exchange("POST", &upload, 403, b"{}".to_vec());
    put.request = b"request".to_vec();
    let (endpoint, handle) = server(vec![exchange("GET", &read, 503, b"{}".to_vec()), put]);
    let store = store(endpoint, Some("pr-1"));

    assert!(matches!(store.get(&name, 64), Err(Error::Internal(_))));
    assert!(matches!(
        store.put(&name, Bytes::from_static(b"request")),
        Err(Error::Internal(_))
    ));
    handle.join().unwrap();
}

#[test]
fn seed_reads_bound_bodies_and_report_oversize_as_integrity_failures() {
    let name = SeedName::new("local", "request.json").unwrap();
    let (read, _) = targets("", "request.json");
    let (endpoint, handle) = server(vec![
        exchange("GET", &read, 200, b"1234".to_vec()),
        exchange("GET", &read, 200, b"12345".to_vec()),
        exchange("GET", &read, 200, b"1234567890123456".to_vec()),
        exchange("GET", &read, 200, Vec::new()),
        exchange("GET", &read, 200, b"1".to_vec()),
    ]);
    let store = store(endpoint, None);

    assert_eq!(store.get(&name, 4).unwrap(), Some(b"1234".to_vec()));
    for _ in 0..2 {
        let Error::Internal(error) = store.get(&name, 4).unwrap_err();
        assert!(matches!(
            error.source_ref().downcast_ref::<IntegrityError>(),
            Some(IntegrityError::TooLarge)
        ));
    }
    assert_eq!(store.get(&name, 0).unwrap(), Some(Vec::new()));
    let Error::Internal(error) = store.get(&name, 0).unwrap_err();
    assert!(matches!(
        error.source_ref().downcast_ref::<IntegrityError>(),
        Some(IntegrityError::TooLarge)
    ));
    handle.join().unwrap();
}
