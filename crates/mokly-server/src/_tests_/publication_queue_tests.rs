//! Coalesced evidence never makes a cached HTTP response wait for publication.

use std::sync::{Arc, Condvar, Mutex};

use axum::body::{Body, Bytes, to_bytes};
use axum::http::Request;
use tokio::sync::{Notify, watch};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, HttpApplication};
use crate::application_evidence::{CompletionQueue, EvidencePublisher};
use crate::assets::File;
use crate::backend::DocumentsMock;
use crate::detail_encoding::{DetailEncoder, DetailEncoderMock, ValidatedDetails};
use crate::publication::{Publications, PublicationsMock, SharedPublication};
use crate::publication_support::{ready, snapshot};
use crate::work::WorkMock;

#[tokio::test]
async fn queued_completions_coalesce_and_close_rejects_late_notices() {
    let empty = Unimock::new(());
    let origin = snapshot(2, Arc::new(empty.clone()));
    let finished = Arc::new(Notify::new());
    let mock = Unimock::new((
        PublicationsMock::current.each_call(matching!()).returns(origin.clone()),
        PublicationsMock::completed_many.next_call(matching!((_, routes) if routes == &["screen-0/index.mobile.html", "screen-1/index.mobile.html"]))
            .answers_arc(Arc::new({ let finished = finished.clone(); move |_, _, _| { finished.notify_one(); Ok(()) } })),
        PublicationsMock::close.next_call(matching!()).returns(()),
    ));
    let queue = CompletionQueue::new(Arc::new(mock.clone()), Arc::new(empty.clone()));
    for _ in 0..8 {
        queue.completed(origin.clone(), "screen-0/index.mobile.html".into());
        queue.completed(origin.clone(), "screen-1/index.mobile.html".into());
        queue.completed(origin.clone(), "page/index.html".into());
    }
    finished.notified().await;
    queue.close().await;
    queue.completed(origin, "screen-0/index.mobile.html".into());
}

#[tokio::test]
async fn cached_document_response_settles_while_a_batch_publication_is_blocked() {
    let entered = Arc::new(Notify::new());
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let mock = Unimock::new((
        DocumentsMock::usage
            .each_call(matching!(_))
            .answers(&|_, _| Some(ready())),
        WorkMock::generated
            .next_call(matching!(_, _))
            .returns(Ok(Some(File {
                bytes: Bytes::from_static(b"cached"),
                content_type: "text/html".into(),
            }))),
        DetailEncoderMock::encode
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new({
                let entered = entered.clone();
                let release = release.clone();
                move |_, detail, index, schemas| {
                    entered.notify_one();
                    let (lock, signal) = &*release;
                    let _released = signal
                        .wait_while(lock.lock().unwrap(), |released| !*released)
                        .unwrap();
                    ValidatedDetails.encode(detail, index, schemas)
                }
            })),
    ));
    let origin = snapshot(4, Arc::new(mock.clone()));
    let mut shared = SharedPublication::new(origin.clone());
    shared
        .completed(&origin, "screen-0/index.mobile.html")
        .unwrap();
    shared.encoder = Arc::new(mock.clone());
    let shared = Arc::new(shared);
    let app = Arc::new(Application::new(
        shared.clone(),
        Arc::new(Unimock::new(())),
        Arc::new(mock.clone()),
        Arc::new(Unimock::new(())),
    ));
    let worker = tokio::task::spawn_blocking({
        let shared = shared.clone();
        move || shared.completed_many(&origin, &["screen-1/index.mobile.html".into()])
    });
    entered.notified().await;
    let response = app
        .clone()
        .router(watch::channel(false).1)
        .oneshot(
            Request::builder()
                .uri("/static/mokly-generated/screen-0/index.mobile.html")
                .header("host", "127.0.0.1:4173")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(
        to_bytes(response.into_body(), usize::MAX).await.unwrap(),
        "cached"
    );
    assert!(!worker.is_finished());
    let (lock, signal) = &*release;
    *lock.lock().unwrap() = true;
    signal.notify_one();
    worker.await.unwrap().unwrap();
    app.publisher.close().await;
}

#[tokio::test]
async fn close_fences_new_notices_and_drains_the_active_publisher() {
    let empty = Unimock::new(());
    let origin = snapshot(2, Arc::new(empty.clone()));
    let entered = Arc::new(Notify::new());
    let fenced = Arc::new(Notify::new());
    let release = Arc::new((Mutex::new(false), Condvar::new()));
    let mock = Unimock::new((
        PublicationsMock::current
            .next_call(matching!())
            .returns(origin.clone()),
        PublicationsMock::completed_many
            .next_call(matching!(_, _))
            .answers_arc(Arc::new({
                let entered = entered.clone();
                let release = release.clone();
                move |_, _, _| {
                    entered.notify_one();
                    let (lock, signal) = &*release;
                    let _released = signal
                        .wait_while(lock.lock().unwrap(), |released| !*released)
                        .unwrap();
                    Ok(())
                }
            })),
        PublicationsMock::close
            .next_call(matching!())
            .answers_arc(Arc::new({
                let fenced = fenced.clone();
                move |_| {
                    fenced.notify_one();
                }
            })),
    ));
    let queue = Arc::new(CompletionQueue::new(
        Arc::new(mock.clone()),
        Arc::new(empty.clone()),
    ));
    queue.completed(origin.clone(), "screen-0/index.mobile.html".into());
    entered.notified().await;
    let closing = tokio::spawn({
        let queue = queue.clone();
        async move {
            queue.close().await;
        }
    });
    fenced.notified().await;
    assert!(!closing.is_finished());
    queue.completed(origin, "screen-1/index.mobile.html".into());
    let (lock, signal) = &*release;
    *lock.lock().unwrap() = true;
    signal.notify_one();
    closing.await.unwrap();
}
