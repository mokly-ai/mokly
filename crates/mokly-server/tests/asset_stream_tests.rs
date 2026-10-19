//! HTTP asset capture checks the generation before delivery and owns immutable response storage.

use std::fs;
use std::io::Read;
use std::path::Path;

use mokly_server::asset_streams::{AssetStreams, TemporaryAssets};

#[expect(
    dead_code,
    reason = "asset delivery uses the shared native HTTP fixture"
)]
#[path = "http/support.rs"]
mod support;

fn opaque_fixture(root: &Path) {
    fs::write(root.join("css/opaque.svg"), vec![b'x'; 128 * 1024]).unwrap();
    let mut css = fs::read_to_string(root.join("css/base.css")).unwrap();
    css.push_str("\n.opaque{background:url('./opaque.svg')}\n");
    fs::write(root.join("css/base.css"), css).unwrap();
}

#[tokio::test]
async fn get_and_head_stream_exact_checked_bytes_and_stale_sources_fail_closed() {
    let harness = support::Harness::with_edit(opaque_fixture).await;
    let url = format!(
        "{}/static/mokly-generated/assets/css/opaque.svg",
        harness.url
    );
    let head = harness.client.head(&url).send().await.unwrap();
    assert_eq!(head.status(), 200);
    assert_eq!(head.headers()["content-length"], (128 * 1024).to_string());
    assert_eq!(head.headers()["content-type"], "image/svg+xml");
    support::headers(&head);
    assert!(head.bytes().await.unwrap().is_empty());
    let get = harness.client.get(&url).send().await.unwrap();
    assert_eq!(get.status(), 200);
    assert_eq!(get.bytes().await.unwrap().as_ref(), vec![b'x'; 128 * 1024]);
    fs::write(
        harness.root.path().join("css/opaque.svg"),
        vec![b'y'; 128 * 1024],
    )
    .unwrap();
    let stale = harness.client.get(&url).send().await.unwrap();
    assert_eq!(stale.status(), 500);
    assert_eq!(
        stale.json::<serde_json::Value>().await.unwrap()["code"],
        "render-failed"
    );
    harness.close().await;
}

#[tokio::test]
async fn verified_response_storage_cannot_change_with_its_authored_source() {
    let harness = support::Harness::with_edit(opaque_fixture).await;
    let mut asset = harness
        .generation
        .open_asset("assets/css/opaque.svg")
        .unwrap()
        .unwrap();
    let streams: &dyn AssetStreams = &TemporaryAssets;
    let mut opened = streams.capture(asset.as_mut(), "image/svg+xml").unwrap();
    fs::write(
        harness.root.path().join("css/opaque.svg"),
        vec![b'y'; 128 * 1024],
    )
    .unwrap();
    let mut body = Vec::new();
    opened.file.read_to_end(&mut body).unwrap();
    assert_eq!(body, vec![b'x'; 128 * 1024]);
    harness.close().await;
}
