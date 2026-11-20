//! Fake monotonic time bounds new batches and retried transaction attempts.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mkc_store_interface::desktop_grant::DesktopGrantsMock;
use mkc_store_interface::magic_link::MagicLinksMock;
use mkc_store_interface::store::{StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};

use crate::prune::{PruneReport, Pruner};
use crate::runtime::RuntimeMock;

use super::tests::{now, service};

fn runtime(elapsed: Arc<AtomicU64>) -> Unimock {
    Unimock::new((
        RuntimeMock::now.some_call(matching!()).returns(now()),
        RuntimeMock::monotonic
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                Duration::from_secs(123) + Duration::from_millis(elapsed.load(Ordering::SeqCst))
            }))
            .at_least_times(0),
    ))
}

fn queries(timeouts: Arc<Mutex<Vec<Duration>>>, desktop: bool) -> Unimock {
    let links = MagicLinksMock::prune_magic_links
        .each_call(matching!(_, _))
        .answers_arc(Arc::new({
            let timeouts = timeouts.clone();
            move |_, _, batch| {
                timeouts.lock().unwrap().push(batch.timeout);
                Ok(if desktop { 7 } else { 1000 })
            }
        }));
    if desktop {
        Unimock::new((
            links,
            DesktopGrantsMock::prune_desktop_grants
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, batch| {
                    timeouts.lock().unwrap().push(batch.timeout);
                    Ok(5)
                })),
        ))
    } else {
        Unimock::new(links)
    }
}

#[test]
fn deadline_stops_new_batches_at_equality_and_keeps_committed_counts() {
    let elapsed = Arc::new(AtomicU64::new(0));
    let timeouts = Arc::new(Mutex::new(Vec::new()));
    let queries = queries(timeouts.clone(), false);
    let transactions = Arc::new(AtomicUsize::new(0));
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let elapsed = elapsed.clone();
                let transactions = transactions.clone();
                move |_, work: &mut dyn Transaction| {
                    transactions.fetch_add(1, Ordering::SeqCst);
                    elapsed.store(479_999, Ordering::SeqCst);
                    work.run(&mut queries.clone())?;
                    elapsed.store(480_000, Ordering::SeqCst);
                    Ok(())
                }
            })),
    );
    assert_eq!(
        service(store, runtime(elapsed)).prune().unwrap(),
        PruneReport {
            links: 1000,
            ..PruneReport::default()
        }
    );
    assert_eq!(transactions.load(Ordering::SeqCst), 1);
    assert_eq!(*timeouts.lock().unwrap(), [Duration::from_millis(1)]);
}

#[test]
fn deadline_on_retry_discards_rolled_back_counts_and_runs_no_more_deletes() {
    let elapsed = Arc::new(AtomicU64::new(0));
    let timeouts = Arc::new(Mutex::new(Vec::new()));
    let queries = queries(timeouts.clone(), true);
    let transactions = Arc::new(AtomicUsize::new(0));
    let store = Unimock::new(
        StoreMock::transaction
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let elapsed = elapsed.clone();
                let transactions = transactions.clone();
                move |_, work: &mut dyn Transaction| {
                    let index = transactions.fetch_add(1, Ordering::SeqCst);
                    work.run(&mut queries.clone())?;
                    if index == 1 {
                        elapsed.store(479_999, Ordering::SeqCst);
                        work.run(&mut queries.clone())?;
                        elapsed.store(480_000, Ordering::SeqCst);
                        work.run(&mut queries.clone())?;
                    }
                    Ok(())
                }
            })),
    );
    assert_eq!(
        service(store, runtime(elapsed)).prune().unwrap(),
        PruneReport {
            links: 7,
            ..PruneReport::default()
        }
    );
    assert_eq!(transactions.load(Ordering::SeqCst), 2);
    assert_eq!(
        *timeouts.lock().unwrap(),
        [
            Duration::from_secs(5),
            Duration::from_secs(5),
            Duration::from_millis(1)
        ]
    );
}
