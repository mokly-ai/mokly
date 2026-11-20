//! Foreground admission and shutdown cannot strand an admitted completion owner.

use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::task::{Context, Waker};

use unimock::Unimock;

use crate::background::Background;
use crate::publication::PublicationEvent;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::publication::pass;
use super::support::{Counts, Renders, route};

#[tokio::test]
async fn completion_progresses_while_foreground_waits_and_then_yields_dispatch() {
    let (mut renders, documents) = Renders::new(3);
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) = pass(
        publication_support::snapshot(3, documents.clone()),
        1,
        work.clone(),
    );
    let task = tokio::spawn(async move { pass.run(stopping).await });
    renders.until(("start", 0)).await;
    renders.root(0);
    renders.until(("start", 1)).await;
    let mut foreground = work.generated(documents, "foreground".into());
    assert!(
        foreground
            .as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    renders.root(1);
    renders.until(("root", 1)).await;
    renders.done(0);
    renders.until(("complete", 1)).await;
    assert!(foreground.await.unwrap().is_none());
    renders.until(("start", 2)).await;
    assert_eq!(
        *renders.starts.lock().unwrap(),
        [route(0), route(1), "foreground".into(), route(2)]
    );
    renders.done(1);
    renders.root(2);
    renders.done(2);
    task.await.unwrap();
    work.stop().await;
    assert_eq!(script.published.lock().unwrap().len(), 1);
    assert_eq!(
        *renders.reports.lock().unwrap(),
        [route(0), route(1), route(2)]
    );
}

#[tokio::test]
async fn cancellation_discards_evidence_and_stop_drains_both_stages() {
    let (mut renders, documents) = Renders::new(3);
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) =
        pass(publication_support::snapshot(3, documents), 1, work.clone());
    let task = tokio::spawn(async move { pass.run(stopping).await });
    renders.until(("start", 0)).await;
    renders.root(0);
    renders.until(("start", 1)).await;
    script.stop.send_replace(true);
    task.await.unwrap();
    let mut stop = Box::pin(work.stop());
    assert!(
        stop.as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    renders.root(1);
    renders.done(0);
    renders.until(("complete", 1)).await;
    assert!(
        stop.as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    assert!(renders.reports.lock().unwrap().is_empty());
    renders.done(1);
    stop.await;
    assert_eq!(*renders.starts.lock().unwrap(), [route(0), route(1)]);
    assert!(renders.reports.lock().unwrap().is_empty());
    assert!(script.published.lock().unwrap().is_empty());
}

#[tokio::test]
async fn replacement_discards_an_old_completion_and_only_publishes_new_evidence() {
    let counts = Arc::new(Counts::default());
    let (mut old, documents) = Renders::with_counts(1, counts.clone());
    let (mut new, replacement) = Renders::with_counts(1, counts.clone());
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) =
        pass(publication_support::snapshot(1, documents), 1, work.clone());
    let task = tokio::spawn(async move { pass.run(stopping).await });
    old.until(("start", 0)).await;
    old.root(0);
    old.until(("complete", 0)).await;
    *script.current.lock().unwrap() = publication_support::snapshot(1, replacement);
    assert!(
        script
            .updates
            .send(PublicationEvent {
                revision: 2,
                deployment_id: "process".into(),
            })
            .is_ok()
    );
    new.until(("start", 0)).await;
    new.root(0);
    new.until(("root", 0)).await;
    old.done(0);
    new.done(0);
    task.await.unwrap();
    work.stop().await;
    assert!(old.reports.lock().unwrap().is_empty());
    assert_eq!(*new.reports.lock().unwrap(), [route(0)]);
    assert_eq!(*script.published.lock().unwrap(), [vec![route(0)]]);
    assert_eq!(counts.completion_peak.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn replacement_shares_transient_budget_and_refused_charge_keeps_its_worker() {
    let (mut old, documents) = Renders::with_charge(1, 4 * 1024 * 1024);
    let (mut new, replacement) = Renders::new(1);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) =
        pass(publication_support::snapshot(1, documents), 2, work.clone());
    let task = tokio::spawn(async move { pass.run(stopping).await });
    old.until(("start", 0)).await;
    old.root(0);
    old.until(("complete", 0)).await;
    *script.current.lock().unwrap() = publication_support::snapshot(1, replacement);
    assert!(
        script
            .updates
            .send(PublicationEvent {
                revision: 2,
                deployment_id: "process".into()
            })
            .is_ok()
    );
    new.until(("start", 0)).await;
    new.root(0);
    new.until(("complete", 0)).await;
    assert_eq!(
        work.workers.available_permits(),
        1,
        "the shared full budget must refuse the replacement charge"
    );
    old.done(0);
    new.done(0);
    task.await.unwrap();
    work.stop().await;
    assert!(old.reports.lock().unwrap().is_empty());
    assert_eq!(*new.reports.lock().unwrap(), [route(0)]);
    assert_eq!(*script.published.lock().unwrap(), [vec![route(0)]]);
}
