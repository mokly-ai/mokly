//! Capacity and old revisions cannot admit extra renderer jobs.

use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::task::{Context, Poll, Waker};

use unimock::{MockFn, Unimock, matching};

use crate::render_request::Rejection;
use crate::revision::{RenderLease, RenderLeaseMock};
use crate::work::Work;

use super::support::{blocked, cleanup, lease, release};

#[tokio::test]
async fn at_most_eight_queued_jobs_wait_and_dropped_jobs_never_render() {
    let (_mock, work, documents, started, gate, calls) = blocked();
    let _cleanup = cleanup(gate.clone());
    let cloned = work.clone();
    let active_documents = documents.clone();
    let active = tokio::spawn(async move {
        cloned
            .preview(
                active_documents,
                "active".into(),
                "home".into(),
                Default::default(),
                lease(),
            )
            .await
    });
    started.notified().await;
    {
        let mut jobs: Vec<_> = (0..8)
            .map(|id| {
                Box::pin(work.preview(
                    documents.clone(),
                    format!("page-{id}"),
                    "home".into(),
                    Default::default(),
                    lease(),
                ))
            })
            .collect();
        let mut context = Context::from_waker(Waker::noop());
        for job in &mut jobs {
            assert!(job.as_mut().poll(&mut context).is_pending());
        }
        assert!(matches!(
            work.preview(
                documents.clone(),
                "overflow".into(),
                "home".into(),
                Default::default(),
                lease()
            )
            .await,
            Err(Rejection::Capacity)
        ));
        let mut replacement = Box::pin(work.preview(
            documents.clone(),
            "page-0".into(),
            "replacement".into(),
            Default::default(),
            lease(),
        ));
        assert!(replacement.as_mut().poll(&mut context).is_pending());
        assert!(matches!(
            jobs[0].as_mut().poll(&mut context),
            Poll::Ready(Err(Rejection::StaleRevision))
        ));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
    release(&gate);
    assert!(active.await.unwrap().is_ok());
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_superseded_queued_revision_does_not_reach_the_renderer() {
    let (_mock, work, documents, started, gate, calls) = blocked();
    let cloned = work.clone();
    let active_documents = documents.clone();
    let active = tokio::spawn(async move {
        cloned
            .preview(
                active_documents,
                "active".into(),
                "home".into(),
                Default::default(),
                lease(),
            )
            .await
    });
    started.notified().await;
    let stale: Arc<dyn RenderLease> = Arc::new(Unimock::new((
        RenderLeaseMock::valid.next_call(matching!()).returns(true),
        RenderLeaseMock::valid.next_call(matching!()).returns(false),
    )));
    let mut queued = Box::pin(work.preview(
        documents,
        "queued".into(),
        "home".into(),
        Default::default(),
        stale,
    ));
    assert!(
        queued
            .as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    release(&gate);
    assert!(active.await.unwrap().is_ok());
    assert!(matches!(queued.await, Err(Rejection::StaleRevision)));
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
