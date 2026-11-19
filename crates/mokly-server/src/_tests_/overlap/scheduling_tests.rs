//! Handoff opens a sidecar place while completion and reports remain bounded.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use unimock::Unimock;

use crate::background::Background;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::publication::pass;
use super::support::{Renders, route};

#[tokio::test]
async fn root_handoffs_overlap_with_bounded_completion_and_ordered_reports() {
    let (mut renders, documents) = Renders::new(4);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, pass, stopping) =
        pass(publication_support::snapshot(4, documents), 2, work.clone());
    let task = tokio::spawn(async move { pass.run(stopping).await });
    renders.until(("start", 0)).await;
    renders.until(("start", 1)).await;
    renders.root(0);
    renders.until(("complete", 0)).await;
    renders.until(("start", 2)).await;
    renders.root(1);
    renders.until(("complete", 1)).await;
    renders.until(("start", 3)).await;
    assert_eq!(renders.counts.sidecars.load(Ordering::SeqCst), 2);
    assert_eq!(renders.counts.completions.load(Ordering::SeqCst), 2);
    assert!(script.published.lock().unwrap().is_empty());
    renders.root(2);
    renders.root(3);
    renders.until(("root", 2)).await;
    renders.until(("root", 3)).await;
    renders.done(2);
    renders.done(3);
    renders.done(1);
    renders.until(("end", 2)).await;
    renders.until(("end", 3)).await;
    assert!(renders.reports.lock().unwrap().is_empty());
    renders.done(0);
    task.await.unwrap();
    work.stop().await;
    let starts = renders.starts.lock().unwrap();
    assert_eq!(
        starts[..2].iter().cloned().collect::<BTreeSet<_>>(),
        BTreeSet::from([route(0), route(1)])
    );
    assert_eq!(starts[2..], [route(2), route(3)]);
    assert_eq!(
        *renders.reports.lock().unwrap(),
        [route(0), route(1), route(2), route(3)]
    );
    assert_eq!(renders.counts.sidecar_peak.load(Ordering::SeqCst), 2);
    assert_eq!(renders.counts.completion_peak.load(Ordering::SeqCst), 2);
    assert_eq!(renders.counts.leases.load(Ordering::SeqCst), 0);
    assert_eq!(
        *script.published.lock().unwrap(),
        [vec![route(0), route(1), route(2), route(3)]]
    );
}
