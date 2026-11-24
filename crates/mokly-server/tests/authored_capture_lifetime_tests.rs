//! Authored HTTP responses release unnamed copies when their bodies end.

#![cfg(target_os = "linux")]

use std::fs;
use std::path::Path;
use std::sync::Arc;

use axum::Router;
use axum::body::{Body, Bytes, to_bytes};
use axum::http::{Request, StatusCode};
use mokly_model::namespace::generated;
use mokly_server::application::{Application, HttpApplication};
use mokly_server::clock::MonotonicClock;
use mokly_server::diagnostics::TracingDiagnostics;
use mokly_server::preview::MemoryPreviews;
use mokly_server::work::Workers;
use tokio::sync::watch;
use tower::ServiceExt;

#[expect(dead_code, reason = "the lifetime test uses the native HTTP fixture")]
#[path = "http/support.rs"]
mod support;

const ASSETS: usize = 8;

fn data(number: usize) -> String {
    format!("<svg id='asset-{number}'/>")
}

fn fixture(root: &Path) {
    let screen = root.join("specs/home.screen.html");
    let mut document = fs::read_to_string(&screen).unwrap();
    for number in 0..ASSETS {
        fs::write(
            root.join(format!("specs/assets/asset-{number}.svg")),
            data(number),
        )
        .unwrap();
        document.push_str(&format!(
            "\n<img src=\"../../specs/assets/asset-{number}.svg\" alt=\"Asset\">"
        ));
    }
    fs::write(screen, document).unwrap();
}

async fn get(router: &Router, path: &str) -> Bytes {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/{path}"))
                .header("host", "127.0.0.1:4173")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK, "{path}");
    to_bytes(response.into_body(), usize::MAX).await.unwrap()
}

#[tokio::test]
async fn sequential_authored_requests_leave_no_open_temporary_copies() {
    let harness = support::Harness::with_edit(fixture).await;
    let captures = tempfile::tempdir().unwrap();
    tempfile::env::override_temp_dir(captures.path()).unwrap();
    let directory = captures.path().canonicalize().unwrap();
    let diagnostics = Arc::new(TracingDiagnostics);
    let app = Arc::new(Application::new(
        harness.publications.clone(),
        Arc::new(MemoryPreviews::new(
            Arc::new(MonotonicClock::default()),
            "authored-capture-lifetime".into(),
        )),
        Arc::new(Workers::new(1, diagnostics.clone())),
        diagnostics,
    ));
    let router = app.router(watch::channel(false).1);
    get(&router, &generated("home/index.mobile.html")).await;
    for number in 0..ASSETS {
        let bytes = get(&router, &format!("static/specs/assets/asset-{number}.svg")).await;
        assert_eq!(bytes, data(number));
    }
    let open_copies = fs::read_dir("/proc/self/fd")
        .unwrap()
        .filter_map(|entry| fs::read_link(entry.unwrap().path()).ok())
        .filter(|path| path.starts_with(&directory))
        .count();
    assert_eq!(open_copies, 0, "authored copies outlived their responses");
    assert_eq!(fs::read_dir(directory).unwrap().count(), 0);
    harness.close().await;
}
