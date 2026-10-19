//! Declared shell, JSON, document, asset, and event routes share one fixed state.

use mokly_model::{canonical, detail_context, readers};

use super::support;

#[tokio::test]
async fn missing_shell_routes_keep_the_stub_and_documents_keep_the_graph_bytes() {
    let harness = support::Harness::new().await;
    for route in [
        "view/",
        "view/missing",
        "view/missing/",
        "view/missing/index.html",
    ] {
        for head in [false, true] {
            let url = format!("{}/{route}", harness.url);
            let response = if head {
                harness.client.head(url)
            } else {
                harness.client.get(url)
            }
            .send()
            .await
            .unwrap();
            assert_eq!(response.status(), 404);
            support::headers(&response);
            assert_eq!(
                response.headers()["content-type"],
                "text/html; charset=utf-8"
            );
            assert_eq!(
                response.headers()["content-length"],
                harness.snapshot.stub.len().to_string()
            );
            let body = response.bytes().await.unwrap();
            assert_eq!(
                body.as_ref(),
                if head {
                    &[]
                } else {
                    harness.snapshot.stub.as_ref()
                }
            );
        }
    }
    let route = "home/index.mobile.html";
    let expected = harness.generation.render(route).unwrap();
    let actual = harness
        .client
        .get(format!("{}/static/mokly-generated/{route}", harness.url))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    assert_eq!(actual.as_ref(), expected.bytes);
    harness.close().await;
}

#[tokio::test]
async fn every_route_has_exact_bytes_headers_and_head_parity() {
    let harness = support::Harness::new().await;
    let index = harness
        .client
        .get(format!("{}/mokly-viewer/index.json", harness.url))
        .send()
        .await
        .unwrap();
    support::headers(&index);
    let bytes = index.text().await.unwrap();
    assert!(!bytes.contains(&harness.snapshot.render_token));
    let index = readers::index(&bytes).unwrap();
    assert_eq!(index.revision, 1);
    assert_eq!(canonical::to_string(&index).unwrap(), bytes);
    insta::assert_snapshot!("pending_index", bytes);
    let mut details = std::collections::BTreeMap::new();
    for entry in &harness.generation.catalogue().model.entries {
        let path = &entry.metadata.path;
        let response = harness
            .client
            .get(format!("{}/mokly-viewer/entries/{path}.json", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        support::headers(&response);
        let text = response.text().await.unwrap();
        assert!(!text.contains(&harness.snapshot.render_token));
        detail_context::read(&text, &index).unwrap();
        details.insert(
            path,
            serde_json::from_str::<serde_json::Value>(&text).unwrap(),
        );
        for route in [
            format!("view/{path}"),
            format!("view/{path}/"),
            format!("view/{path}/index.html"),
        ] {
            let response = harness
                .client
                .get(format!("{}/{route}", harness.url))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
            assert_eq!(response.bytes().await.unwrap(), harness.snapshot.stub);
        }
    }
    insta::assert_snapshot!("pending_details", canonical::to_string(&details).unwrap());
    for route in ["", "index.html", "404.html"] {
        let response = harness
            .client
            .get(format!("{}/{route}", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert_eq!(response.bytes().await.unwrap(), harness.snapshot.stub);
    }
    assert_eq!(
        harness
            .client
            .get(format!("{}/static/specs/assets/public.svg", harness.url))
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
    assert!(harness.generation.public_files().is_empty());
    let mut paths: Vec<_> = harness
        .snapshot
        .files
        .keys()
        .chain(harness.snapshot.assets.keys())
        .cloned()
        .collect();
    paths.extend([String::new(), "index.html".into(), "404.html".into()]);
    paths.extend(
        harness
            .generation
            .plans()
            .keys()
            .map(|route| format!("static/mokly-generated/{route}")),
    );
    paths.extend(
        harness
            .generation
            .resource_routes()
            .iter()
            .map(|route| format!("static/mokly-generated/{route}")),
    );
    for path in paths {
        let response = harness
            .client
            .get(format!("{}/{path}", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            200,
            "{path}: {}",
            response.text().await.unwrap()
        );
        support::headers(&response);
        let content_type = response.headers()["content-type"].clone();
        let length = response.bytes().await.unwrap().len();
        let head = harness
            .client
            .head(format!("{}/{path}", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(head.status(), 200, "{path}");
        support::headers(&head);
        assert_eq!(head.headers()["content-type"], content_type);
        assert_eq!(head.headers()["content-length"], length.to_string());
        assert!(head.bytes().await.unwrap().is_empty());
    }
    let public = harness
        .client
        .get(format!("{}/static/specs/assets/public.svg", harness.url))
        .send()
        .await
        .unwrap();
    assert_eq!(public.status(), 200);
    assert_eq!(
        public.bytes().await.unwrap(),
        std::fs::read(harness.root.path().join("specs/assets/public.svg")).unwrap()
    );
    harness.close().await;
}

#[tokio::test]
async fn events_send_the_current_identity_at_once_and_shutdown_closes_the_stream() {
    let harness = support::Harness::new().await;
    let mut response = harness
        .client
        .get(format!("{}/mokly-viewer/events", harness.url))
        .send()
        .await
        .unwrap();
    support::headers(&response);
    assert_eq!(response.headers()["content-type"], "text/event-stream");
    let message = response.chunk().await.unwrap().unwrap();
    assert_eq!(
        message,
        format!("id: 1\ndata: {}\n\n", harness.snapshot.index.deployment_id)
    );
    let head = harness
        .client
        .head(format!("{}/mokly-viewer/events", harness.url))
        .send()
        .await
        .unwrap();
    assert_eq!(head.status(), 200);
    assert!(head.bytes().await.unwrap().is_empty());
    harness.close().await;
    assert!(response.chunk().await.unwrap().is_none());
}
