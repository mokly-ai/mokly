//! Fake time and retained page gates protect timeout and replacement ordering.

use std::future::Future;
use std::sync::atomic::Ordering;
use std::task::{Context, Poll, Waker};
use std::time::Duration;

use crate::render_request::Rejection;
use crate::work::Work;

use super::support::{blocked, blocked_with, cleanup, lease, release};

#[tokio::test(start_paused = true)]
async fn ten_second_deadline_uses_fake_time_and_active_work_drains() {
    let (_mock, work, documents, _started, gate, calls) = blocked_with(1, true, 1);
    let cloned = work.clone();
    let active_documents = documents.clone();
    let task = tokio::spawn(async move {
        cloned
            .preview(
                active_documents,
                "one".into(),
                "home".into(),
                Default::default(),
                lease(),
            )
            .await
    });
    while calls.load(Ordering::SeqCst) == 0 {
        tokio::task::yield_now().await;
    }
    tokio::time::advance(Duration::from_millis(9_999)).await;
    assert!(!task.is_finished());
    tokio::time::advance(Duration::from_millis(1)).await;
    assert!(matches!(task.await.unwrap(), Err(Rejection::RenderFailed)));
    release(&gate);
    work.stop().await;
    assert!(matches!(
        work.preview(
            documents.clone(),
            "closed".into(),
            "home".into(),
            Default::default(),
            lease()
        )
        .await,
        Err(Rejection::Capacity)
    ));
}

#[tokio::test]
async fn only_the_latest_queued_edit_of_a_page_reaches_the_renderer() {
    let (_mock, work, documents, started, gate, calls) = blocked();
    let cloned = work.clone();
    let active_documents = documents.clone();
    let active = tokio::spawn(async move {
        cloned
            .preview(
                active_documents,
                "page".into(),
                "old".into(),
                Default::default(),
                lease(),
            )
            .await
    });
    started.notified().await;
    let mut context = Context::from_waker(Waker::noop());
    let mut first = Box::pin(work.preview(
        documents.clone(),
        "page".into(),
        "superseded".into(),
        Default::default(),
        lease(),
    ));
    assert!(first.as_mut().poll(&mut context).is_pending());
    let mut latest = Box::pin(work.preview(
        documents.clone(),
        "page".into(),
        "latest".into(),
        Default::default(),
        lease(),
    ));
    assert!(latest.as_mut().poll(&mut context).is_pending());
    assert!(matches!(
        first.as_mut().poll(&mut context),
        Poll::Ready(Err(Rejection::StaleRevision))
    ));
    assert!(matches!(
        active.await.unwrap(),
        Err(Rejection::StaleRevision)
    ));
    release(&gate);
    assert!(latest.await.is_ok());
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test(start_paused = true)]
async fn a_timed_out_job_keeps_its_page_gate_until_the_renderer_stops() {
    let (_mock, work, documents, _started, gate, calls) = blocked_with(2, true, 1);
    let _cleanup = cleanup(gate.clone());
    let cloned = work.clone();
    let active_documents = documents.clone();
    let active = tokio::spawn(async move {
        cloned
            .preview(
                active_documents,
                "page".into(),
                "old".into(),
                Default::default(),
                lease(),
            )
            .await
    });
    while calls.load(Ordering::SeqCst) == 0 {
        tokio::task::yield_now().await;
    }
    tokio::time::advance(Duration::from_secs(10)).await;
    assert!(matches!(
        active.await.unwrap(),
        Err(Rejection::RenderFailed)
    ));
    let mut next = Box::pin(work.preview(
        documents.clone(),
        "page".into(),
        "next".into(),
        Default::default(),
        lease(),
    ));
    assert!(
        next.as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    assert_eq!(work.workers.available_permits(), 1);
    release(&gate);
    while work.workers.available_permits() != 2 {
        tokio::task::yield_now().await;
    }
    assert!(next.await.is_ok());
    work.stop().await;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}
