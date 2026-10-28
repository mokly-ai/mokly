//! Batches keep the worker bound, yield to foreground requests, and start in route order.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::task::{Context, Waker};

use unimock::Unimock;

use crate::background::Background;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::support::{Renders, pass, route};

#[tokio::test]
async fn a_batch_keeps_its_bound_and_yields_to_a_foreground_request() {
    let (mut renders, documents) = Renders::new(&[&route(0), &route(1)], &[]);
    let origin = publication_support::snapshot(4, documents.clone());
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) = pass(
        origin.clone(),
        2,
        work.clone(),
        Arc::new(Unimock::new(())),
        true,
    );
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let first = BTreeSet::from([renders.next_start().await, renders.next_start().await]);
    assert_eq!(first, BTreeSet::from([route(0), route(1)]));
    let mut foreground = work.generated(documents.clone(), "foreground".into());
    assert!(
        foreground
            .as_mut()
            .poll(&mut Context::from_waker(Waker::noop()))
            .is_pending()
    );
    renders.release(&route(0));
    assert!(foreground.await.unwrap().is_none());
    assert_eq!(renders.next_start().await, "foreground");
    assert_eq!(renders.next_start().await, route(2));
    renders.release(&route(1));
    task.await.unwrap();
    work.stop().await;
    assert_eq!(
        renders.started()[2..],
        ["foreground".to_owned(), route(2), route(3)]
    );
    assert_eq!(renders.peak(), 2);
    let routes: Vec<_> = origin
        .routes
        .iter()
        .map(|view| view.route.clone())
        .collect();
    assert_eq!(*script.published.lock().unwrap(), [routes]);
}

#[tokio::test]
async fn queued_renders_start_in_catalogue_order() {
    let (mut renders, documents) = Renders::new(&["foreground"], &[]);
    let origin = publication_support::snapshot(4, documents.clone());
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let foreground = tokio::spawn({
        let work = work.clone();
        let documents = documents.clone();
        async move { work.generated(documents, "foreground".into()).await }
    });
    assert_eq!(renders.next_start().await, "foreground");
    let (_script, pass, stopping) = pass(origin, 3, work.clone(), Arc::new(Unimock::new(())), true);
    let mut running = pass.run(stopping);
    let mut context = Context::from_waker(Waker::noop());
    for _ in 0..8 {
        assert!(running.as_mut().poll(&mut context).is_pending());
    }
    assert_eq!(renders.started(), ["foreground"]);
    renders.release("foreground");
    assert!(foreground.await.unwrap().unwrap().is_none());
    running.await;
    work.stop().await;
    assert_eq!(
        renders.started(),
        [
            "foreground".to_owned(),
            route(0),
            route(1),
            route(2),
            route(3)
        ]
    );
    assert_eq!(renders.peak(), 1);
}
