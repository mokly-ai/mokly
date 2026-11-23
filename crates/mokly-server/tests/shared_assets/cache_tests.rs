//! Resource validators follow the bytes returned at stable Serve URLs.

use std::fs::{self, File, FileTimes};
use std::path::Path;

use mokly_model::namespace::generated;
use mokly_server::publication::PublicationWriter;
use reqwest::{Method, StatusCode};
use sha2::{Digest, Sha256};

use crate::support::Harness;

use super::support::{ROUTE, fixture, generation};

fn etag(bytes: &[u8]) -> String {
    let hash: String = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("\"{hash}\"")
}

fn stylesheet(harness: &Harness) -> String {
    let route = harness
        .generation
        .resource_routes()
        .into_iter()
        .find(|route| route.starts_with("styles/"))
        .unwrap();
    format!("{}/{}", harness.url, generated(&route))
}

async fn reach_authored_asset(harness: &Harness) -> String {
    let url = format!("{}/{}", harness.url, generated("home/index.mobile.html"));
    let document = harness
        .client
        .get(url)
        .header("if-none-match", "*")
        .send()
        .await
        .unwrap();
    assert_eq!(document.status(), StatusCode::OK);
    assert_eq!(document.headers()["cache-control"], "no-store");
    assert_eq!(document.headers().get("etag"), None);
    format!("{}/static/specs/assets/public.svg", harness.url)
}

#[tokio::test]
async fn generated_and_authored_assets_revalidate_get_and_head() {
    let harness = Harness::with_edit(fixture).await;
    let authored = reach_authored_asset(&harness).await;
    for url in [
        stylesheet(&harness),
        format!("{}/{}", harness.url, generated(ROUTE)),
        authored,
    ] {
        let first = harness.client.get(&url).send().await.unwrap();
        assert_eq!(first.status(), StatusCode::OK, "{url}");
        assert_eq!(first.headers()["cache-control"], "no-cache", "{url}");
        let headers = first.headers().clone();
        let bytes = first.bytes().await.unwrap();
        let tag = etag(&bytes);
        assert_eq!(headers["etag"], tag, "{url}");

        let head = harness.client.head(&url).send().await.unwrap();
        assert_eq!(head.status(), StatusCode::OK);
        for name in ["etag", "cache-control", "content-length", "content-type"] {
            assert_eq!(head.headers()[name], headers[name], "{url} {name}");
        }
        assert!(head.bytes().await.unwrap().is_empty());

        for (method, validator) in [
            (Method::GET, tag.clone()),
            (Method::GET, format!("\"unmatched,tag\", W/{tag}")),
            (Method::HEAD, "*".into()),
        ] {
            let response = harness
                .client
                .request(method, &url)
                .header("if-none-match", "\"another\"")
                .header("if-none-match", &validator)
                .send()
                .await
                .unwrap();
            assert_eq!(
                response.status(),
                StatusCode::NOT_MODIFIED,
                "{url} {validator}"
            );
            assert_eq!(response.headers()["etag"], tag);
            assert_eq!(response.headers()["cache-control"], "no-cache");
            assert!(response.bytes().await.unwrap().is_empty());
        }
    }
    harness.close().await;
}

#[tokio::test]
async fn changed_stylesheet_at_same_url_rejects_old_etag() {
    let harness = Harness::new().await;
    let url = stylesheet(&harness);
    let original = harness.client.get(&url).send().await.unwrap();
    assert_eq!(original.status(), StatusCode::OK);
    let headers = original.headers().clone();
    let original = original.bytes().await.unwrap();
    let old = etag(&original);

    let path = harness.root.path().join("css/base.css");
    let css = fs::read_to_string(&path).unwrap();
    fs::write(path, format!("{css}\n.updated{{color:chartreuse}}\n")).unwrap();
    let replacement = harness.project_replacement(generation(harness.root.path()));
    assert!(harness.publications.replace(replacement));

    let next = harness
        .client
        .get(&url)
        .header("if-none-match", &old)
        .send()
        .await
        .unwrap();
    assert_eq!(next.status(), StatusCode::OK);
    let next_headers = next.headers().clone();
    let updated = next.bytes().await.unwrap();
    assert_ne!(original, updated);
    assert_eq!(
        next_headers
            .get("etag")
            .and_then(|value| value.to_str().ok()),
        Some(etag(&updated).as_str())
    );
    assert_eq!(headers["etag"], old);
    assert_ne!(next_headers["etag"], headers["etag"]);
    harness.close().await;
}

fn small_authored_asset(root: &Path) {
    fs::write(root.join("specs/assets/public.svg"), "<svg id='one'/>").unwrap();
}

#[tokio::test]
async fn same_size_authored_edit_with_preserved_mtime_revalidates_against_new_bytes() {
    let harness = Harness::with_edit(small_authored_asset).await;
    let url = reach_authored_asset(&harness).await;
    let first = harness.client.get(&url).send().await.unwrap();
    let original_tag = etag(&first.bytes().await.unwrap());

    let path = harness.root.path().join("specs/assets/public.svg");
    let time = fs::metadata(&path).unwrap().modified().unwrap();
    fs::write(&path, "<svg id='two'/>").unwrap();
    File::options()
        .write(true)
        .open(&path)
        .unwrap()
        .set_times(FileTimes::new().set_modified(time))
        .unwrap();
    let status = harness
        .client
        .get(&url)
        .header("if-none-match", &original_tag)
        .send()
        .await
        .unwrap();
    assert_eq!(status.status(), StatusCode::OK);
    let tag = etag(b"<svg id='two'/>");
    assert_eq!(
        status
            .headers()
            .get("etag")
            .and_then(|value| value.to_str().ok()),
        Some(tag.as_str())
    );
    assert_eq!(status.bytes().await.unwrap(), "<svg id='two'/>");
    let unchanged = harness
        .client
        .head(&url)
        .header("if-none-match", &tag)
        .send()
        .await
        .unwrap();
    assert_eq!(unchanged.status(), StatusCode::NOT_MODIFIED);
    harness.close().await;
}
