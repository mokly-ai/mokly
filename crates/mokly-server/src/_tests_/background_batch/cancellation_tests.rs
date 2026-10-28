//! A replacement or a stop ends a batch: queued routes never start and nothing stale publishes.

use std::collections::BTreeSet;
use std::sync::Arc;

use unimock::Unimock;

use crate::background::Background;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::support::{Renders, pass, route};

#[tokio::test]
async fn a_replacement_during_a_batch_cancels_its_queued_renders() {
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
async fn a_stop_during_a_batch_publishes_nothing() {
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
