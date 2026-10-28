//! A batch reports each failed render once, in catalogue order, after earlier renders end.

use std::collections::BTreeSet;
use std::sync::Arc;

use unimock::Unimock;

use crate::background::Background;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::support::{Renders, failure, pass, reports, route};

#[tokio::test]
async fn failed_renders_report_once_in_catalogue_order() {
    let (mut renders, documents) = Renders::new(&[&route(0), &route(3)], &[&route(0), &route(2)]);
    let origin = publication_support::snapshot(4, documents);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (diagnostics, reported) = reports();
    let (script, pass, stopping) = pass(origin, 2, work.clone(), diagnostics, true);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let mut seen = BTreeSet::new();
    while !seen.contains(&route(3)) {
        seen.insert(renders.next_start().await);
    }
    assert_eq!(
        seen,
        BTreeSet::from([route(0), route(1), route(2), route(3)])
    );
    assert!(reported.lock().unwrap().is_empty());
    renders.release(&route(0));
    renders.release(&route(3));
    task.await.unwrap();
    work.stop().await;
    assert_eq!(
        *reported.lock().unwrap(),
        [
            failure(&route(0)).to_string(),
            failure(&route(2)).to_string()
        ]
    );
    assert_eq!(script.published.lock().unwrap().len(), 1);
}
