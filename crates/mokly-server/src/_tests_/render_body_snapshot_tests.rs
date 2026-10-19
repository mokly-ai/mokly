//! Pending request bytes retain no replaced publication or comparison capture.

use std::convert::Infallible;
use std::sync::Arc;

use axum::body::{Body, Bytes, to_bytes};
use axum::http::{Request, StatusCode};
use serde_json::json;
use tokio::sync::{oneshot, watch};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, HttpApplication};
use crate::comparison_support::historical;
use crate::publication::{PublicationWriter, SharedPublication};
use crate::publication_support::snapshot;
use crate::render_request::Rejection;
use crate::work::WorkMock;

fn request(body: Body) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/mokly-viewer/components/render")
        .header("host", "127.0.0.1:4173")
        .header("origin", "http://127.0.0.1:4173")
        .header("x-mokly-render-token", "secret")
        .header("content-type", "application/json")
        .body(body)
        .unwrap()
}

fn body_bytes(revision: u64) -> Bytes {
    serde_json::to_vec(&json!({
        "entryPath": "components/action", "viewport": "mobile", "colorScheme": "light",
        "revision": revision, "pageId": "a".repeat(32), "overrides": {}
    }))
    .unwrap()
    .into()
}

fn held_body() -> (Body, oneshot::Receiver<()>, oneshot::Sender<Bytes>) {
    let (started, observed) = oneshot::channel();
    let (send, receive) = oneshot::channel();
    let body = Body::from_stream(async_stream::stream! {
        started.send(()).unwrap();
        yield Ok::<Bytes, Infallible>(receive.await.unwrap());
    });
    (body, observed, send)
}

#[tokio::test]
async fn stalled_body_releases_the_replaced_snapshot_and_base_capture() {
    let (publications, original, classification, base) = {
        let changes = historical();
        let classification = Arc::downgrade(&changes);
        let base = Arc::downgrade(&changes.result.before);
        let mut first = snapshot(0, Arc::new(Unimock::new(())));
        Arc::get_mut(&mut first).unwrap().changes = Some(changes);
        let original = Arc::downgrade(&first);
        (
            Arc::new(SharedPublication::new(first)),
            original,
            classification,
            base,
        )
    };
    let app = Arc::new(Application::new(
        publications.clone(),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
    ));
    let (body, started, finish) = held_body();
    let response = app
        .clone()
        .router(watch::channel(false).1)
        .oneshot(request(body));
    tokio::pin!(response);
    tokio::select! {
        result = &mut response => panic!("body completed before release: {:?}", result.unwrap().status()),
        result = started => result.unwrap(),
    }
    assert!(original.upgrade().is_some());
    assert!(classification.upgrade().is_some());
    assert!(base.upgrade().is_some());
    assert!(publications.replace(snapshot(0, Arc::new(Unimock::new(()))).at_revision(2)));
    assert!(
        original.upgrade().is_none(),
        "stalled body retained the old snapshot"
    );
    assert!(
        classification.upgrade().is_none(),
        "stalled body retained the old classification"
    );
    assert!(
        base.upgrade().is_none(),
        "stalled body retained the old base capture"
    );
    finish.send(body_bytes(1)).unwrap();
    let response = response.await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap()["code"],
        "stale-revision"
    );
    app.publisher.close().await;
}

#[tokio::test]
async fn completed_body_uses_the_current_backend_and_keeps_the_revision_fence() {
    for replace_during_render in [false, true] {
        let publications = Arc::new(SharedPublication::new(snapshot(
            0,
            Arc::new(Unimock::new(())),
        )));
        let next = snapshot(0, Arc::new(Unimock::new(()))).at_revision(2);
        let work = Unimock::new(
            WorkMock::preview
                .next_call(matching!(_, _, _, _, _))
                .answers_arc(Arc::new({
                    let publications = publications.clone();
                    let next = next.clone();
                    move |_, documents, _, route, _, lease| {
                        assert!(Arc::ptr_eq(&documents, &next.documents));
                        assert!(Arc::ptr_eq(&lease, &next.lease));
                        assert!(lease.valid());
                        assert_eq!(route, "components/action/index.mobile.html");
                        if replace_during_render {
                            assert!(publications.replace(next.at_revision(3)));
                        }
                        Err(Rejection::RenderFailed)
                    }
                })),
        );
        let app = Arc::new(Application::new(
            publications.clone(),
            Arc::new(Unimock::new(())),
            Arc::new(work.clone()),
            Arc::new(Unimock::new(())),
        ));
        let (body, started, finish) = held_body();
        let response = app
            .clone()
            .router(watch::channel(false).1)
            .oneshot(request(body));
        tokio::pin!(response);
        tokio::select! {
            result = &mut response => panic!("body completed before release: {:?}", result.unwrap().status()),
            result = started => result.unwrap(),
        }
        assert!(publications.replace(next));
        finish.send(body_bytes(2)).unwrap();
        let response = response.await.unwrap();
        assert_eq!(
            response.status(),
            if replace_during_render {
                StatusCode::CONFLICT
            } else {
                StatusCode::UNPROCESSABLE_ENTITY
            }
        );
        app.publisher.close().await;
    }
}
