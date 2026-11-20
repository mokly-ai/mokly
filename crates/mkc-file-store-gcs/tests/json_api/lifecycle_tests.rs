//! Recorded JSON API shapes for object writes, reads, deletes and listings.

use bytes::Bytes;
use mkc_file_store_interface::deadline::OperationDeadline;
use serde_json::json;
use std::time::Duration;

use crate::support::fixtures::{key, store};
use crate::support::server::{exchange, server};

fn deadline() -> OperationDeadline {
    OperationDeadline::new(Duration::from_secs(60))
}

#[test]
fn unprefixed_json_api_lifecycle_preserves_exact_requests() {
    lifecycle(None, "");
}

#[test]
fn prefixed_json_api_lifecycle_scopes_every_operation() {
    lifecycle(Some("pr-1"), "pr-1/");
}

fn lifecycle(prefix: Option<&str>, namespace: &str) {
    let bytes = b"published catalogue";
    let key = key(bytes);
    let logical_name = key.object_name();
    let name = format!("{namespace}{logical_name}");
    let encoded_name = name.replace('/', "%2F");
    let encoded_namespace = namespace.replace('/', "%2F");
    let object = format!("/storage/v1/b/catalogue-fixture/o/{encoded_name}");
    let read = format!("{object}?alt=media");
    let metadata = format!("{object}?fields=size");
    let upload = format!(
        "/upload/storage/v1/b/catalogue-fixture/o?uploadType=media&name={encoded_name}&ifGenerationMatch=0"
    );
    let list_target = format!(
        "/storage/v1/b/catalogue-fixture/o?prefix={encoded_namespace}sha256%2F&maxResults=2&fields=items%28name%2CtimeCreated%29%2CnextPageToken"
    );
    let insert = json!({
        "kind": "storage#object", "name": name, "bucket": "catalogue-fixture",
        "generation": "1726488000000000", "metageneration": "1",
        "size": bytes.len().to_string(), "contentType": "application/octet-stream",
        "timeCreated": "2026-09-16T12:00:00.000Z"
    });
    let mut put = exchange("POST", &upload, 200, serde_json::to_vec(&insert).unwrap());
    put.request = bytes.to_vec();
    let mut duplicate = exchange(
        "POST",
        &upload,
        412,
        include_bytes!("../../fixtures/precondition.json").to_vec(),
    );
    duplicate.request = bytes.to_vec();
    let listing = json!({
        "kind": "storage#objects", "items": [insert],
        "nextPageToken": "next+page/token=opaque"
    });
    let (endpoint, handle) = server(vec![
        put,
        duplicate,
        exchange(
            "GET",
            &metadata,
            200,
            serde_json::to_vec(&json!({"size": bytes.len().to_string()})).unwrap(),
        ),
        exchange("GET", &read, 200, bytes.to_vec()),
        exchange(
            "GET",
            &list_target,
            200,
            serde_json::to_vec(&listing).unwrap(),
        ),
        exchange(
            "GET",
            &format!("{list_target}&pageToken=next%2Bpage%2Ftoken%3Dopaque"),
            200,
            b"{}".to_vec(),
        ),
        exchange("DELETE", &object, 204, Vec::new()),
        exchange(
            "GET",
            &read,
            404,
            include_bytes!("../../fixtures/not-found.json").to_vec(),
        ),
        exchange(
            "DELETE",
            &object,
            404,
            include_bytes!("../../fixtures/not-found.json").to_vec(),
        ),
    ]);
    let store = store(endpoint, prefix);
    store
        .put(&key, Bytes::from_static(bytes), deadline())
        .unwrap();
    store
        .put(&key, Bytes::from_static(bytes), deadline())
        .unwrap();
    assert_eq!(store.get(&key).unwrap(), Some(bytes.to_vec()));
    let page = store.list(None, 2).unwrap();
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].key, key);
    assert_eq!(page.items[0].key.object_name(), logical_name);
    assert_eq!(
        page.items[0].created_at.to_rfc3339(),
        "2026-09-16T12:00:00+00:00"
    );
    assert_eq!(page.next_cursor.as_deref(), Some("next+page/token=opaque"));
    let next = store.list(page.next_cursor.as_deref(), 2).unwrap();
    assert!(next.items.is_empty());
    assert_eq!(next.next_cursor, None);
    store.delete(&key).unwrap();
    assert!(store.get(&key).unwrap().is_none());
    store.delete(&key).unwrap();
    handle.join().unwrap();
}

#[test]
fn listing_requires_an_exact_namespace_boundary_and_keeps_empty_page_cursors() {
    let key = key(b"published catalogue");
    let name = key.object_name();
    let foreign = [
        name.clone(),
        format!("pr-10/{name}"),
        format!("pr-2/{name}"),
        format!("other/pr-1/{name}"),
        format!("pr-1/pr-1/{name}"),
        format!("pr-1//{name}"),
        format!("pr-1{name}"),
        "pr-1/not-a-blob".to_owned(),
    ];
    let mut items: Vec<_> = foreign
        .iter()
        .map(|name| {
            json!({
                "name": name, "timeCreated": "2026-09-15T12:00:00.000Z"
            })
        })
        .collect();
    let empty = json!({"items": items, "nextPageToken": "foreign+page/token"});
    items.push(json!({
        "name": format!("pr-1/{name}"), "timeCreated": "2026-09-16T12:00:00.000Z"
    }));
    let mixed = json!({"items": items});
    let target = "/storage/v1/b/catalogue-fixture/o?prefix=pr-1%2Fsha256%2F&maxResults=1000&fields=items%28name%2CtimeCreated%29%2CnextPageToken";
    let (endpoint, handle) = server(vec![
        exchange("GET", target, 200, serde_json::to_vec(&empty).unwrap()),
        exchange(
            "GET",
            &format!("{target}&pageToken=foreign%2Bpage%2Ftoken"),
            200,
            serde_json::to_vec(&mixed).unwrap(),
        ),
    ]);
    let store = store(endpoint, Some("pr-1"));
    let page = store.list(None, 1000).unwrap();
    assert!(page.items.is_empty());
    assert_eq!(page.next_cursor.as_deref(), Some("foreign+page/token"));
    let page = store.list(page.next_cursor.as_deref(), 1000).unwrap();
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].key, key);
    assert_eq!(
        page.items[0].created_at.to_rfc3339(),
        "2026-09-16T12:00:00+00:00"
    );
    assert_eq!(page.next_cursor, None);
    handle.join().unwrap();
}

#[test]
fn provider_failure_and_corrupt_content_never_become_success() {
    let key = key(b"expected");
    for namespace in ["", "pr-1/"] {
        for (status, bytes) in [(503, b"unavailable".to_vec()), (200, b"corrupt".to_vec())] {
            let name = format!("{namespace}{}", key.object_name()).replace('/', "%2F");
            let target = format!("/storage/v1/b/catalogue-fixture/o/{name}?alt=media");
            let (endpoint, handle) = server(vec![exchange("GET", &target, status, bytes)]);
            let store = store(endpoint, namespace.strip_suffix('/'));
            assert!(store.get(&key).is_err());
            handle.join().unwrap();
        }
    }
}

#[test]
fn duplicate_upload_rejects_mismatched_metadata_inside_its_namespace() {
    let bytes = b"expected";
    let key = key(bytes);
    for namespace in ["", "pr-1/"] {
        let name = format!("{namespace}{}", key.object_name()).replace('/', "%2F");
        let target = format!(
            "/upload/storage/v1/b/catalogue-fixture/o?uploadType=media&name={name}&ifGenerationMatch=0"
        );
        let mut duplicate = exchange(
            "POST",
            &target,
            412,
            include_bytes!("../../fixtures/precondition.json").to_vec(),
        );
        duplicate.request = bytes.to_vec();
        let target = format!("/storage/v1/b/catalogue-fixture/o/{name}?fields=size");
        let (endpoint, handle) = server(vec![
            duplicate,
            exchange("GET", &target, 200, br#"{"size":"999"}"#.to_vec()),
        ]);
        let store = store(endpoint, namespace.strip_suffix('/'));
        assert!(
            store
                .put(&key, Bytes::from_static(bytes), deadline())
                .is_err()
        );
        handle.join().unwrap();
    }
}
