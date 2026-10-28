//! A batch reports each view's warnings and failure once, in catalogue order, after every
//! earlier render ends.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_catalogue::diagnostic::Warning;
use mokly_graph::error::GraphError;
use tokio::sync::oneshot;
use unimock::Unimock;

use crate::background::Background;
use crate::background_batch::Window;
use crate::error::{Result, ServerError};
use crate::publication_support;
use crate::work::{Work, Workers};

use super::script::{pass, recording, reports};
use super::support::{Renders, failure, route, warning};

#[tokio::test]
async fn failed_renders_report_once_in_catalogue_order() {
    let (mut renders, documents) =
        Renders::new(&[&route(0), &route(3), &route(4)], &[&route(0), &route(2)]);
    let origin = publication_support::snapshot(5, documents);
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
    assert_eq!(renders.next_start().await, route(4));
    let expected = [
        failure(&route(0)).to_string(),
        failure(&route(2)).to_string(),
    ];
    assert_eq!(*reported.lock().unwrap(), expected);
    renders.release(&route(3));
    renders.release(&route(4));
    task.await.unwrap();
    work.stop().await;
    assert_eq!(*reported.lock().unwrap(), expected);
    assert_eq!(script.published.lock().unwrap().len(), 1);
}

/// Every order in which four renders can end.
fn end_orders() -> Vec<Vec<usize>> {
    let mut orders = vec![Vec::new()];
    for _ in 0..4 {
        orders = orders
            .into_iter()
            .flat_map(|order: Vec<usize>| {
                (0..4)
                    .filter(|position| !order.contains(position))
                    .map(|position| [order.clone(), vec![position]].concat())
                    .collect::<Vec<_>>()
            })
            .collect();
    }
    orders
}

#[tokio::test]
async fn the_window_releases_each_outcome_once_every_earlier_render_ends() {
    let failing = [0, 2];
    let warned = 1;
    let text = |outcome: &Result<Vec<Warning>>| match outcome {
        Ok(warnings) => warnings
            .iter()
            .map(|warning| warning.message.clone())
            .collect(),
        Err(error) => error.to_string(),
    };
    for order in end_orders() {
        let mut window = Window::new(4);
        let mut senders = Vec::new();
        for position in 0..4 {
            let (sender, receiver) = oneshot::channel::<Result<Vec<Warning>>>();
            senders.push(Some(sender));
            window.start(position, Box::pin(async move { receiver.await.unwrap() }));
        }
        let mut ended = BTreeSet::new();
        let mut released = Vec::new();
        for &position in &order {
            let outcome = if failing.contains(&position) {
                Err(failure(&route(position)))
            } else if position == warned {
                Ok(vec![warning(&route(position))])
            } else {
                Ok(Vec::new())
            };
            assert!(senders[position].take().unwrap().send(outcome).is_ok());
            let (settled, outcome) = window.next().await;
            assert_eq!(settled, position);
            ended.insert(position);
            released.extend(window.settle(settled, outcome).iter().map(text));
            let expected: Vec<_> = [0, 1, 2]
                .into_iter()
                .filter(|held| (0..=*held).all(|earlier| ended.contains(&earlier)))
                .map(|held| match held {
                    1 => warning(&route(1)).message,
                    _ => failure(&route(held)).to_string(),
                })
                .collect();
            assert_eq!(released, expected, "end order {order:?}");
        }
        assert!(window.is_empty());
    }
}

#[tokio::test]
async fn warnings_and_failures_report_once_per_view_in_catalogue_order() {
    let (mut renders, documents) = Renders::warned(
        &[&route(0)],
        &[&route(1)],
        &[&route(0), &route(1), &route(2)],
    );
    let origin = publication_support::snapshot(3, documents);
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let events = renders.events();
    let diagnostics = recording(events.clone(), "failed ");
    let (script, pass, stopping) = pass(origin, 2, work.clone(), diagnostics, true);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let mut seen = BTreeSet::new();
    while !seen.contains(&route(2)) {
        seen.insert(renders.next_start().await);
    }
    assert!(events.lock().unwrap().is_empty());
    renders.release(&route(0));
    task.await.unwrap();
    work.stop().await;
    let render_failure = ServerError::Render {
        source: GraphError::Attempt {
            failures: Vec::new(),
            warnings: vec![warning(&route(1))],
        },
    };
    assert_eq!(
        *events.lock().unwrap(),
        [
            format!("{}, failed false", warning(&route(0)).message),
            format!("{}, failed true", warning(&route(1)).message),
            format!("failed {render_failure}"),
            format!("{}, failed false", warning(&route(2)).message),
        ]
    );
    assert_eq!(script.published.lock().unwrap().len(), 1);
}
