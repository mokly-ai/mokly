//! Independent process cases run side by side on a bounded set of threads.

use std::num::NonZeroUsize;
use std::sync::Mutex;
use std::thread;

/// Run `check` once for each labelled case, with at most one case per
/// available core at a time.
///
/// The caller keeps the cases independent: no case reads or writes a file
/// that another case writes. Each case runs on a thread named after its
/// label, so a failed assertion names its case. A failed case does not stop
/// the other cases. The call panics after every case has ended and names
/// each failed case.
pub(crate) fn each<T: Send>(
    cases: impl IntoIterator<Item = (String, T)>,
    check: impl Fn(T) + Sync,
) {
    let cases: Vec<_> = cases.into_iter().collect();
    let width = thread::available_parallelism()
        .map_or(1, NonZeroUsize::get)
        .min(cases.len())
        .max(1);
    let queue = Mutex::new(cases.into_iter());
    let failed = Mutex::new(Vec::new());
    let (queue, failed_ref, check) = (&queue, &failed, &check);
    thread::scope(|scope| {
        for _ in 0..width {
            scope.spawn(move || {
                while let Some((label, case)) = next(queue) {
                    let result = thread::Builder::new()
                        .name(label.clone())
                        .spawn_scoped(scope, move || check(case))
                        .unwrap()
                        .join();
                    if result.is_err() {
                        failed_ref.lock().unwrap().push(label);
                    }
                }
            });
        }
    });
    let failed = failed.into_inner().unwrap();
    assert!(failed.is_empty(), "failed cases: {failed:?}");
}

fn next<I: Iterator>(queue: &Mutex<I>) -> Option<I::Item> {
    queue.lock().unwrap().next()
}
