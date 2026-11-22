//! Replacing a pass keeps the real-miss batch occupied before an old root returns.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use tokio::sync::{Notify, mpsc};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::Background;
use crate::background_capacity::BackgroundCapacityMock;
use crate::publication_event::PublicationEvent;
use crate::publication_support;
use crate::work::{Work, Workers};

use super::publication::pass;
use super::support::{Renders, route};

#[tokio::test]
async fn replacement_miss_waits_for_the_shared_batch_without_holding_a_worker() {
    let (mut old, documents) = Renders::new(1);
    let (mut new, replacement) = Renders::new(1);
    let read = Arc::new(Notify::new());
    let replacement = Arc::new(Unimock::new((
        DocumentsMock::background_read
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let replacement = replacement.clone();
                let read = read.clone();
                move |_, route| {
                    let result = replacement.background_read(route);
                    read.notify_one();
                    result
                }
            })),
        DocumentsMock::report
            .each_call(matching!(_, false))
            .answers_arc(Arc::new(move |_, warnings, failed| {
                replacement.report(warnings, failed);
            })),
    )));
    let queries = Arc::new(AtomicUsize::new(0));
    let (attempted, mut attempts) = mpsc::unbounded_channel();
    let capacity = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                attempted
                    .send(queries.fetch_add(1, Ordering::SeqCst) + 1)
                    .unwrap();
                1
            })),
    );
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (script, mut pass, stopping) =
        pass(publication_support::snapshot(1, documents), 1, work.clone());
    pass.capacity = Arc::new(capacity);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    old.until(("start", 0)).await;
    assert_eq!(attempts.recv().await.unwrap(), 1);
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
    read.notified().await;
    assert_eq!(
        attempts.recv().await.unwrap(),
        2,
        "the new real miss samples fresh C"
    );
    assert_eq!(
        work.workers.available_permits(),
        1,
        "old root owns one worker; the replacement miss waits for the shared batch without one"
    );
    assert!(new.starts.lock().unwrap().is_empty());
    old.root(0);
    old.done(0);
    new.until(("start", 0)).await;
    new.root(0);
    new.done(0);
    task.await.unwrap();
    work.stop().await;
    assert!(old.reports.lock().unwrap().is_empty());
    assert_eq!(*new.reports.lock().unwrap(), [route(0)]);
    assert_eq!(*script.published.lock().unwrap(), [vec![route(0)]]);
}
