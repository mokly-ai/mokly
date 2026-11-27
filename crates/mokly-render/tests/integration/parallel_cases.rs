//! Independent fixture cases run on scoped threads and keep their table order.

use std::panic;
use std::thread;

/// Run each case on its own named thread and return the results in case order.
///
/// Each case must own its consumer, temporary directory, and sidecar pool, so
/// the cases share no state. A case panic reaches the test with the thread name,
/// which names the case.
pub(super) fn run<C, R>(
    cases: &[C],
    name: impl Fn(&C) -> String,
    case: impl Fn(&C) -> R + Sync,
) -> Vec<R>
where
    C: Sync,
    R: Send,
{
    thread::scope(|scope| {
        let handles: Vec<_> = cases
            .iter()
            .map(|item| {
                let case = &case;
                thread::Builder::new()
                    .name(name(item))
                    .spawn_scoped(scope, move || case(item))
                    .unwrap()
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .unwrap_or_else(|panic| panic::resume_unwind(panic))
            })
            .collect()
    })
}
