//! Concurrent initial misses share each target check through the live flight lock.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::link_results::{self, LinkResults, LinkResultsMock, MemoryLinkResults};
use crate::validation;

use super::validation_cache_tests::reference;
use super::validation_sharing_tests::sharing;

#[test]
fn concurrent_pair_misses_recheck_under_the_flight_lock_and_release_every_request() {
    let mut probe = sharing(false, false, link_results::LIMIT);
    let retained = Arc::new(MemoryLinkResults::new(link_results::LIMIT));
    let reads = retained.clone();
    let writes = retained.clone();
    let barrier = Arc::new(Barrier::new(4));
    let arrivals = AtomicUsize::new(0);
    Arc::get_mut(&mut probe.session.state).unwrap().link_results = Arc::new(Unimock::new((
        LinkResultsMock::get
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, view, fragment| {
                if view == 0 && arrivals.fetch_add(1, Ordering::SeqCst) < 4 {
                    barrier.wait();
                    return None;
                }
                reads.get(view, fragment)
            })),
        LinkResultsMock::record
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, view, fragment, present| {
                writes.record(view, fragment, present);
            })),
    )));
    thread::scope(|scope| {
        let handles: Vec<_> = (0..4)
            .map(|_| {
                scope.spawn(|| validation::links(&probe.session, &[reference("target", "summary")]))
            })
            .collect();
        for handle in handles {
            handle.join().unwrap().unwrap();
        }
    });
    assert_eq!(probe.compositions.load(Ordering::SeqCst), 4);
    assert_eq!(probe.reads.load(Ordering::SeqCst), 4);
    assert_eq!(retained.len(), 4);
    assert!(probe.session.state.anchor_flights.is_empty());
}
