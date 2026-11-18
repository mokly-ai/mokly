//! A test-owned paused runtime carries its capture to each blocking worker.

use std::cell::RefCell;
use std::future::Future;

use mokly_test_support::capture::Trace;
use tokio::runtime::Builder;
use tracing::dispatcher::DefaultGuard;

thread_local! {
    static CAPTURE: RefCell<Option<DefaultGuard>> = const { RefCell::new(None) };
}

/// Keep the caller and every test runtime thread under one scoped dispatcher.
pub(crate) fn in_runtime<T>(trace: &Trace, run: impl Future<Output = T>) -> T {
    let dispatcher = trace.dispatcher();
    let runtime = Builder::new_current_thread()
        .enable_all()
        .start_paused(true)
        .on_thread_start(move || {
            CAPTURE.with(|capture| {
                *capture.borrow_mut() = Some(tracing::dispatcher::set_default(&dispatcher));
            });
        })
        .on_thread_stop(|| {
            CAPTURE.with(|capture| {
                capture.borrow_mut().take();
            });
        })
        .build()
        .unwrap();
    trace.in_scope(|| runtime.block_on(run))
}
