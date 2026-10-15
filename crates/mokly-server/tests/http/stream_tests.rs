//! Large reached assets stream from a confined handle without a new size limit.

use std::fs::File;

use mokly_server::publication::Publications;
use serde_json::json;

use super::support;

#[tokio::test]
async fn a_large_authored_asset_streams_and_the_existing_preview_budget_still_applies() {
    let harness = support::Harness::new().await;
    let response = harness
        .client
        .get(format!(
            "{}/static/mokly-generated/home/index.mobile.html",
            harness.url
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let length = 40 * 1024 * 1024_u64;
    File::create(harness.root.path().join("specs/assets/public.svg"))
        .unwrap()
        .set_len(length)
        .unwrap();
    let url = format!("{}/static/specs/assets/public.svg", harness.url);
    let head = harness.client.head(&url).send().await.unwrap();
    assert_eq!(head.status(), 200);
    assert_eq!(head.headers()["content-length"], length.to_string());
    assert!(head.bytes().await.unwrap().is_empty());
    let mut response = harness.client.get(url).send().await.unwrap();
    assert_eq!(response.status(), 200);
    support::headers(&response);
    let mut received = 0_u64;
    while let Some(chunk) = response.chunk().await.unwrap() {
        assert!(chunk.iter().all(|byte| *byte == 0));
        received += chunk.len() as u64;
    }
    assert_eq!(received, length);
    let snapshot = harness.publications.current();
    let preview = harness.client.post(format!("{}/mokly-viewer/components/render", harness.url))
        .header("origin", &harness.url).header("x-mokly-render-token", &snapshot.render_token)
        .json(&json!({"entryPath":"home","viewport":"mobile","colorScheme":"light","revision":snapshot.index.revision,"pageId":"c".repeat(32),"overrides":{}}))
        .send().await.unwrap();
    assert_eq!(preview.status(), 429);
    harness.close().await;
}
