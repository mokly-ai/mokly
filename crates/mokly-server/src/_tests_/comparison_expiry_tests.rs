//! Real comparison routes recover collected selections with an injected server clock.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use axum::Router;
use axum::body::{Body, Bytes, to_bytes};
use axum::http::{Method, Request, StatusCode};
use axum::response::Response;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::axes::EntryKind;
use mokly_model::readers;
use mokly_model::review::ReviewKind;
use tokio::sync::watch;
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, HttpApplication};
use crate::clock::ClockMock;
use crate::comparison_capture::SnapshotCapture;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, snapshot};
use crate::entropy::EntropyMock;
use crate::publication::SharedPublication;

const SELECTED: &str = "/mokly-viewer/diffs/review.json?path=sample";

fn graph(document: &'static [u8], stylesheet: &'static [u8]) -> Arc<dyn RenderGeneration> {
    let artifact = Arc::new(Artifact {
        bytes: document.into(),
        content_type: "text/html".into(),
        document: None,
        fragment: None,
    });
    Arc::new(Unimock::new((
        RenderGenerationMock::render
            .each_call(matching!("sample/index.mobile.html"))
            .answers_arc(Arc::new(move |_, _| Ok(artifact.clone())))
            .n_times(2),
        RenderGenerationMock::closure
            .each_call(matching!("sample/index.mobile.html"))
            .answers(&|_, _| {
                Ok(Closure {
                    edges: [("static/theme.css".into(), Vec::new())].into(),
                    ..Default::default()
                })
            })
            .n_times(2),
        RenderGenerationMock::resource_bytes
            .each_call(matching!("static/theme.css"))
            .answers_arc(Arc::new(move |_, _| Ok(Some(stylesheet.into()))))
            .n_times(2),
    )))
}

fn setup(kind: ReviewKind) -> (Router, Arc<MemoryComparisons>, Arc<AtomicU64>) {
    let mut input = accepted(
        graph(b"<p>Before</p>", b"p{color:red}"),
        graph(b"<p>After</p>", b"p{color:blue}"),
    );
    if kind == ReviewKind::Component {
        let result = &mut Arc::get_mut(&mut input).unwrap().result;
        result.entries[0].kind = EntryKind::Component;
        let entry = &mut result.review.entries[0];
        entry.kind = kind;
        entry.before.as_mut().unwrap().supplied_slots = Some(Vec::new());
        entry.after.as_mut().unwrap().supplied_slots = Some(Vec::new());
    }
    let publications = Arc::new(SharedPublication::new(snapshot(Some(input))));
    let now = Arc::new(AtomicU64::new(0));
    let observed = now.clone();
    let serial = AtomicU64::new(0);
    let store = Arc::new(MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| observed.load(Ordering::SeqCst))),
        )),
        Arc::new(Unimock::new(
            EntropyMock::secret
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    format!("{:032x}", serial.fetch_add(1, Ordering::SeqCst)).repeat(2)
                }))
                .n_times(2),
        )),
        Arc::new(SnapshotCapture),
        publications.clone(),
        Arc::new(Unimock::new(())),
    ));
    let mut app = Application::new(
        publications,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    );
    app.comparisons = Some(store.clone());
    (Arc::new(app).router(watch::channel(false).1), store, now)
}

async fn request(router: &Router, method: Method, uri: &str) -> Response {
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header("host", "127.0.0.1:4173")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    response
}

async fn select(router: &Router) -> String {
    let response = request(router, Method::GET, SELECTED).await;
    assert_eq!(response.status(), StatusCode::FOUND);
    response.headers()["location"].to_str().unwrap().to_owned()
}

async fn read_selection(router: &Router, url: &str, kind: ReviewKind) -> Bytes {
    let response = request(router, Method::GET, url).await;
    assert_eq!(response.status(), StatusCode::OK);
    let json = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let review = readers::review(std::str::from_utf8(&json).unwrap()).unwrap();
    assert_eq!(review.entries.len(), 1);
    assert_eq!(review.entries[0].kind, kind);
    assert_eq!(review.entries[0].path, "sample");
    let directory = url.strip_suffix("review.json").unwrap();
    for (side, document, stylesheet) in [
        ("before", "<p>Before</p>", "p{color:red}"),
        ("after", "<p>After</p>", "p{color:blue}"),
    ] {
        for (path, expected) in [
            ("mokly-generated/sample/index.mobile.html", document),
            ("theme.css", stylesheet),
        ] {
            let response = request(
                router,
                Method::GET,
                &format!("{directory}snapshots/{side}/{path}"),
            )
            .await;
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(
                to_bytes(response.into_body(), usize::MAX).await.unwrap(),
                expected
            );
        }
    }
    json
}

async fn idle_recovery(kind: ReviewKind) {
    let (router, store, now) = setup(kind);
    let original = select(&router).await;
    let json = read_selection(&router, &original, kind).await;
    now.store(59_999, Ordering::SeqCst);
    store.collect();
    assert_eq!(store.state.lock().unwrap().bundles.len(), 1);
    let head = request(&router, Method::HEAD, &original).await;
    assert_eq!(head.status(), StatusCode::OK);
    assert!(
        to_bytes(head.into_body(), usize::MAX)
            .await
            .unwrap()
            .is_empty()
    );
    now.store(119_998, Ordering::SeqCst);
    store.collect();
    assert_eq!(store.state.lock().unwrap().bundles.len(), 1);
    assert_eq!(store.state.lock().unwrap().selections.len(), 1);
    now.store(119_999, Ordering::SeqCst);
    store.collect();
    assert!(store.state.lock().unwrap().bundles.is_empty());
    assert!(store.state.lock().unwrap().selections.is_empty());
    let expired = request(&router, Method::HEAD, &original).await;
    assert_eq!(expired.status(), StatusCode::NOT_FOUND);
    assert!(
        to_bytes(expired.into_body(), usize::MAX)
            .await
            .unwrap()
            .is_empty()
    );
    let replacement = select(&router).await;
    assert_ne!(replacement, original);
    assert_eq!(read_selection(&router, &replacement, kind).await, json);
    store.stop().await;
}

#[tokio::test]
async fn idle_screen_comparison_renews_then_recovers_after_collection() {
    idle_recovery(ReviewKind::Screen).await;
}

#[tokio::test]
async fn idle_component_comparison_renews_then_recovers_after_collection() {
    idle_recovery(ReviewKind::Component).await;
}
