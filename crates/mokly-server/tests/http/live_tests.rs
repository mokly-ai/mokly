//! Live HTML props share the graph while capability, revision, and bytes stay private.

use mokly_model::usage_context;
use serde_json::{Value, json};

use super::support;

#[tokio::test]
async fn html_screen_component_and_variant_edits_are_isolated() {
    let harness = support::Harness::new().await;
    let before = harness
        .client
        .get(format!("{}/mokly-viewer/index.json", harness.url))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    for path in ["home", "home/hidden", "components/button"] {
        let response = harness.client.post(format!("{}/mokly-viewer/components/render", harness.url))
            .header("origin", &harness.url).header("x-mokly-render-token", &harness.snapshot.render_token)
            .json(&json!({"entryPath":path,"viewport":"mobile","colorScheme":"light","revision":1,"pageId":"b".repeat(32),"overrides":{"label":{"kind":"set","value":"Edited label"}}})).send().await.unwrap();
        assert_eq!(
            response.status(),
            200,
            "{path}: {}",
            response.text().await.unwrap()
        );
        support::headers(&response);
        let result: Value = response.json().await.unwrap();
        assert_eq!(result["revision"], 1);
        assert_eq!(result["props"]["label"], json!(["string", "Edited label"]));
        let usage = serde_json::from_value(result["usage"].clone()).unwrap();
        usage_context::validate(
            &usage,
            if path.starts_with("components/") {
                mokly_model::axes::EntryKind::Component
            } else {
                mokly_model::axes::EntryKind::Screen
            },
            &harness.snapshot.index.components,
        )
        .unwrap();
        let preview = harness
            .client
            .get(format!(
                "{}{}",
                harness.url,
                result["previewUrl"].as_str().unwrap()
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(preview.status(), 200);
        support::headers(&preview);
        let html = preview.text().await.unwrap();
        assert!(html.contains("Edited label"));
        assert!(!html.contains("inspector.js"));
        assert!(!html.contains(&harness.snapshot.render_token));
        let head = harness
            .client
            .head(format!(
                "{}{}",
                harness.url,
                result["previewUrl"].as_str().unwrap()
            ))
            .send()
            .await
            .unwrap();
        assert_eq!(head.status(), 200);
        assert!(head.bytes().await.unwrap().is_empty());
    }
    assert_eq!(
        harness
            .client
            .get(format!("{}/mokly-viewer/index.json", harness.url))
            .send()
            .await
            .unwrap()
            .bytes()
            .await
            .unwrap(),
        before
    );
    assert!(!harness.root.path().join("mokly-static").exists());
    harness.close().await;
}

#[tokio::test]
async fn render_method_body_origin_token_view_and_revision_are_fenced() {
    let harness = support::Harness::new().await;
    let url = format!("{}/mokly-viewer/components/render", harness.url);
    let valid = json!({"entryPath":"home","viewport":"mobile","colorScheme":"light","revision":1,"pageId":"c".repeat(32),"overrides":{}});
    for (origin, token, status) in [
        (
            "http://evil.test",
            harness.snapshot.render_token.as_str(),
            403,
        ),
        (harness.url.as_str(), "wrong", 403),
        ("", "", 403),
    ] {
        let response = harness
            .client
            .post(&url)
            .header("origin", origin)
            .header("x-mokly-render-token", token)
            .json(&valid)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), status);
        support::headers(&response);
    }
    let post = |body: Value| {
        harness
            .client
            .post(&url)
            .header("origin", &harness.url)
            .header("x-mokly-render-token", &harness.snapshot.render_token)
            .json(&body)
    };
    for (field, value, expected) in [
        ("revision", json!(0), 409),
        ("entryPath", json!("missing"), 404),
        ("viewport", json!("wide"), 400),
        ("module", json!("private.tsx"), 400),
        ("pageId", json!("bad"), 400),
        (
            "overrides",
            json!({"unknown":{"kind":"set","value":1}}),
            400,
        ),
        ("overrides", json!({"label":{"kind":"unset"}}), 400),
    ] {
        let mut body = valid.clone();
        body[field] = value;
        let response = post(body).send().await.unwrap();
        assert_eq!(response.status(), expected, "{field}");
    }
    let response = harness
        .client
        .post(&url)
        .header("origin", &harness.url)
        .header("x-mokly-render-token", &harness.snapshot.render_token)
        .header("content-type", "application/json")
        .body(" ".repeat(65537))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 413);
    assert_eq!(harness.client.get(&url).send().await.unwrap().status(), 405);
    for host in ["localhost:9999", "127.0.0.1:9999"] {
        let response = harness
            .client
            .post(&url)
            .header("host", host)
            .header("origin", format!("http://{host}"))
            .header("x-mokly-render-token", &harness.snapshot.render_token)
            .json(&valid)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
    }
    harness.close().await;
}
