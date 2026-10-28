//! A replacement or a stop ends a batch: no later route starts, renders that wait for
//! admission are dropped, held reports are discarded on every path, and nothing stale
//! publishes.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::task::{Context, Waker};

use tokio::task::JoinHandle;
use unimock::Unimock;

use crate::assets::File;
use crate::backend::Documents;
use crate::background::Background;
use crate::error::Result;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::script::{Script, pass, reports};
use super::support::{Renders, route};

#[tokio::test]
async fn a_replacement_during_a_batch_starts_no_later_route() {
    let (mut renders, documents) = Renders::new(&[&route(0), &route(1)], &[]);
    let (mut replacement_renders, replaced) = Renders::new(&[], &[]);
    let origin = publication_support::snapshot(4, documents);
    let replacement = publication_support::snapshot(1, replaced);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) = pass(origin, 2, work.clone(), Arc::new(Unimock::new(())), true);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let first = BTreeSet::from([renders.next_start().await, renders.next_start().await]);
    assert_eq!(first, BTreeSet::from([route(0), route(1)]));
    script.replace(replacement);
    renders.release(&route(0));
    renders.release(&route(1));
    assert_eq!(replacement_renders.next_start().await, route(0));
    task.await.unwrap();
    work.stop().await;
    assert_eq!(renders.started().len(), 2);
    assert_eq!(replacement_renders.started(), [route(0)]);
    assert_eq!(*script.published.lock().unwrap(), [vec![route(0)]]);
}

#[tokio::test]
async fn a_stop_during_a_batch_starts_no_later_route_and_publishes_nothing() {
    let (mut renders, documents) = Renders::new(&[&route(0), &route(1)], &[]);
    let origin = publication_support::snapshot(4, documents);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) = pass(origin, 2, work.clone(), Arc::new(Unimock::new(())), false);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let first = BTreeSet::from([renders.next_start().await, renders.next_start().await]);
    assert_eq!(first, BTreeSet::from([route(0), route(1)]));
    script.stop.send_replace(true);
    task.await.unwrap();
    assert_eq!(renders.active(), 2);
    renders.release(&route(0));
    renders.release(&route(1));
    work.stop().await;
    assert_eq!(renders.started().len(), 2);
    assert!(script.published.lock().unwrap().is_empty());
}

/// Hold the only worker with a foreground request that waits for its gate.
async fn held(
    work: &Arc<Workers>,
    documents: &Arc<dyn Documents>,
    renders: &mut Renders,
) -> JoinHandle<Result<Option<File>>> {
    let foreground = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        async move { work.generated(documents, "foreground".into()).await }
    });
    assert_eq!(renders.next_start().await, "foreground");
    foreground
}

#[tokio::test]
async fn a_replacement_drops_renders_that_wait_for_admission() {
    let (mut renders, documents) = Renders::new(&["foreground"], &[]);
    let (mut replacement_renders, replaced) = Renders::new(&[], &[]);
    let origin = publication_support::snapshot(4, documents.clone());
    let replacement = publication_support::snapshot(1, replaced);
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let foreground = held(&work, &documents, &mut renders).await;
    let (script, pass, stopping) = pass(origin, 3, work.clone(), Arc::new(Unimock::new(())), true);
    let mut running = pass.run(stopping);
    let mut context = Context::from_waker(Waker::noop());
    for _ in 0..8 {
        assert!(running.as_mut().poll(&mut context).is_pending());
    }
    script.replace(replacement);
    assert!(running.as_mut().poll(&mut context).is_pending());
    renders.release("foreground");
    assert!(foreground.await.unwrap().unwrap().is_none());
    running.await;
    work.stop().await;
    assert_eq!(renders.started(), ["foreground"]);
    assert_eq!(replacement_renders.next_start().await, route(0));
    assert_eq!(*script.published.lock().unwrap(), [vec![route(0)]]);
}

#[tokio::test]
async fn a_stop_drops_renders_that_wait_for_admission() {
    let (mut renders, documents) = Renders::new(&["foreground"], &[]);
    let origin = publication_support::snapshot(4, documents.clone());
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let foreground = held(&work, &documents, &mut renders).await;
    let (script, pass, stopping) = pass(origin, 3, work.clone(), Arc::new(Unimock::new(())), false);
    let mut running = pass.run(stopping);
    let mut context = Context::from_waker(Waker::noop());
    for _ in 0..8 {
        assert!(running.as_mut().poll(&mut context).is_pending());
    }
    script.stop.send_replace(true);
    running.await;
    renders.release("foreground");
    assert!(foreground.await.unwrap().unwrap().is_none());
    work.background(documents, route(9)).await.unwrap();
    work.stop().await;
    assert_eq!(renders.started(), ["foreground".to_owned(), route(9)]);
    assert!(script.published.lock().unwrap().is_empty());
}

/// A pass whose route 1 failure waits while routes 0 and 2 run behind their gates. No
/// render can end until the test releases a gate, so the test picks the path that ends
/// the pass. A third worker stays free for a replacement's render.
struct HeldFailure {
    renders: Renders,
    script: Script,
    task: JoinHandle<()>,
    work: Arc<Workers>,
    reported: Arc<Mutex<Vec<String>>>,
}

async fn held_failure(publishes: bool) -> HeldFailure {
    let (mut renders, documents) = Renders::new(&[&route(0), &route(2)], &[&route(1)]);
    let origin = publication_support::snapshot(3, documents);
    let work = Arc::new(Workers::new(3, Arc::new(Unimock::new(()))));
    let (diagnostics, reported) = reports();
    let (script, pass, stopping) = pass(origin, 2, work.clone(), diagnostics, publishes);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let seen = renders.wait_for(&[route(0), route(1), route(2)]).await;
    assert_eq!(seen, BTreeSet::from([route(0), route(1), route(2)]));
    HeldFailure {
        renders,
        script,
        task,
        work,
        reported,
    }
}

#[tokio::test]
async fn an_announced_replacement_discards_a_held_failure() {
    let held = held_failure(true).await;
    let (mut replacement_renders, replaced) = Renders::new(&[], &[]);
    held.script
        .replace(publication_support::snapshot(1, replaced));
    assert_eq!(replacement_renders.next_start().await, route(0));
    held.renders.release(&route(0));
    held.renders.release(&route(2));
    held.task.await.unwrap();
    held.work.stop().await;
    assert!(held.reported.lock().unwrap().is_empty());
    assert_eq!(*held.script.published.lock().unwrap(), [vec![route(0)]]);
}

#[tokio::test]
async fn a_replacement_seen_when_a_render_ends_discards_a_held_failure() {
    let held = held_failure(true).await;
    let (mut replacement_renders, replaced) = Renders::new(&[], &[]);
    held.script.swap(publication_support::snapshot(1, replaced));
    held.renders.release(&route(0));
    assert_eq!(replacement_renders.next_start().await, route(0));
    held.renders.release(&route(2));
    held.task.await.unwrap();
    held.work.stop().await;
    assert!(held.reported.lock().unwrap().is_empty());
    assert_eq!(*held.script.published.lock().unwrap(), [vec![route(0)]]);
}

#[tokio::test]
async fn a_stop_discards_a_held_failure() {
    let held = held_failure(false).await;
    held.script.stop.send_replace(true);
    held.task.await.unwrap();
    held.renders.release(&route(0));
    held.renders.release(&route(2));
    held.work.stop().await;
    assert!(held.reported.lock().unwrap().is_empty());
    assert!(held.script.published.lock().unwrap().is_empty());
}
