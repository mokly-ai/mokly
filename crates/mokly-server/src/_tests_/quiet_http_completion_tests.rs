//! An on-demand response records equal evidence without an event or a new revision.

use std::sync::Arc;

use axum::body::{Body, Bytes, to_bytes};
use axum::http::Request;
use tokio::sync::{Notify, broadcast::error::TryRecvError, watch};
use tower::ServiceExt;
use unimock::{MockFn, Unimock, matching};

use crate::application::{Application, HttpApplication};
use crate::assets::File;
use crate::backend::DocumentsMock;
use crate::publication::{Publications, PublicationsMock, SharedPublication};
use crate::publication_support::{ready, unrecorded_ready};
use crate::work::WorkMock;

#[tokio::test]
async fn on_demand_equal_usage_completes_once_without_publishing() {
    let finished = Arc::new(Notify::new());
    let documents = Unimock::new(
        DocumentsMock::usage
            .next_call(matching!("screen-0/index.mobile.html"))
            .answers(&|_, _| Some(ready())),
    );
    let origin = unrecorded_ready(2, Arc::new(documents.clone()));
    let shared = Arc::new(SharedPublication::new(origin.clone()));
    let mut events = shared.subscribe();
    let publication = Unimock::new((
        PublicationsMock::current
            .each_call(matching!())
            .answers_arc(Arc::new({
                let shared = shared.clone();
                move |_| shared.current()
            })),
        PublicationsMock::completed_many
            .next_call(matching!((_, routes) if routes == &["screen-0/index.mobile.html"]))
            .answers_arc(Arc::new({
                let shared = shared.clone();
                let finished = finished.clone();
                move |_, origin, routes| {
                    let result = shared.completed_many(origin, routes);
                    finished.notify_one();
                    result
                }
            })),
        PublicationsMock::close.next_call(matching!()).returns(()),
    ));
    let work = Unimock::new(
        WorkMock::generated
            .each_call(matching!(_, "screen-0/index.mobile.html"))
            .answers(&|_, _, _| {
                Ok(Some(File {
                    bytes: Bytes::from_static(b"saved document"),
                    content_type: "text/html".into(),
                }))
            })
            .n_times(2),
    );
    let app = Arc::new(Application::new(
        Arc::new(publication.clone()),
        Arc::new(Unimock::new(())),
        Arc::new(work.clone()),
        Arc::new(Unimock::new(())),
    ));
    for attempt in 0..2 {
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
            "saved document"
        );
        if attempt == 0 {
            finished.notified().await;
            assert!(
                shared
                    .current()
                    .completed
                    .contains_key("screen-0/index.mobile.html")
            );
        }
    }
    app.publisher.close().await;
    assert_eq!(shared.current().index.revision, origin.index.revision);
    assert!(Arc::ptr_eq(&shared.current().lease, &origin.lease));
    assert!(origin.lease.valid());
    assert!(matches!(
        events.updates.try_recv(),
        Err(TryRecvError::Empty)
    ));
}
