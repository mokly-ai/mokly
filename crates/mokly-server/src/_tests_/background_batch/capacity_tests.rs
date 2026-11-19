//! A normal completion lets the same usage pass grow its background window.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::background::Background;
use crate::background_capacity::BackgroundCapacityMock;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::script::pass;
use super::support::{Renders, route};

#[tokio::test]
async fn a_background_window_grows_after_memory_recovers_and_a_render_ends() {
    let (mut renders, documents) =
        Renders::ordered(&[&route(0), &route(1), &route(2)], &[&route(1), &route(2)]);
    let origin = publication_support::snapshot(4, documents);
    let work = Arc::new(Workers::new(3, Arc::new(Unimock::new(()))));
    let (_script, mut pass, stopping) =
        pass(origin, 1, work.clone(), Arc::new(Unimock::new(())), true);
    let count = Arc::new(AtomicUsize::new(1));
    let capacity = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let count = count.clone();
                move |_| count.load(Ordering::SeqCst)
            })),
    );
    pass.capacity = Arc::new(capacity);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    assert_eq!(renders.next_start().await, route(0));
    count.store(2, Ordering::SeqCst);
    renders.release(&route(0));
    assert_eq!(renders.next_start().await, route(1));
    assert_eq!(renders.next_start().await, route(2));
    assert_eq!(renders.peak(), 2);
    renders.release(&route(1));
    renders.release(&route(2));
    task.await.unwrap();
    work.stop().await;
    assert_eq!(renders.peak(), 2);
    assert_eq!(
        renders.started().into_iter().collect::<BTreeSet<_>>(),
        BTreeSet::from([route(0), route(1), route(2), route(3)])
    );
}
