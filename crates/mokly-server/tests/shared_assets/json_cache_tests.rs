//! Authored JSON negotiates content coding and validates the selected representation.

use std::fs;
use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use mokly_model::namespace::generated;
use reqwest::StatusCode;
use sha2::{Digest, Sha256};

use crate::support::Harness;

fn json_asset(root: &Path) {
    fs::write(
        root.join("specs/assets/authored.json"),
        br#"{"source":"guide"}"#,
    )
    .unwrap();
    let screen = root.join("specs/home.screen.html");
    let text = fs::read_to_string(&screen).unwrap();
    fs::write(
        screen,
        text.replace("assets/public.svg", "assets/authored.json"),
    )
    .unwrap();
}

#[tokio::test]
async fn authored_json_negotiates_gzip_and_validates_the_selected_bytes() {
    let harness = Harness::with_edit(json_asset).await;
    let screen = format!("{}/{}", harness.url, generated("home/index.mobile.html"));
    assert_eq!(
        harness.client.get(screen).send().await.unwrap().status(),
        StatusCode::OK
    );
    let url = format!("{}/static/specs/assets/authored.json", harness.url);
    let gzip = harness
        .client
        .get(&url)
        .header("accept-encoding", "gzip")
        .send()
        .await
        .unwrap();
    assert_eq!(gzip.status(), StatusCode::OK);
    assert_eq!(
        gzip.headers()
            .get("content-encoding")
            .map(|value| value.to_str().unwrap()),
        Some("gzip")
    );
    let headers = gzip.headers().clone();
    let compressed = gzip.bytes().await.unwrap();
    assert_eq!(headers["content-length"], compressed.len().to_string());
    let hash: String = Sha256::digest(&compressed)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let tag = format!("\"{hash}\"");
    assert_eq!(headers["etag"], tag);
    let plain = harness.client.get(&url).send().await.unwrap();
    assert_eq!(plain.status(), StatusCode::OK);
    assert_ne!(plain.headers()["etag"], headers["etag"]);
    let mut decoded = Vec::new();
    GzDecoder::new(compressed.as_ref())
        .read_to_end(&mut decoded)
        .unwrap();
    assert_eq!(plain.bytes().await.unwrap(), decoded);
    let unchanged = harness
        .client
        .head(&url)
        .header("accept-encoding", "gzip")
        .header("if-none-match", &tag)
        .send()
        .await
        .unwrap();
    assert_eq!(unchanged.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(unchanged.headers()["etag"], tag);
    assert_eq!(unchanged.headers()["vary"], "Accept-Encoding");
    assert!(unchanged.bytes().await.unwrap().is_empty());
    harness.close().await;
}
