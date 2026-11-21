//! Two existing head processes retain an old published generation before each edit.

use std::sync::Arc;
use std::thread;

use unimock::{MockFn, Unimock, matching};

use crate::methods::{BundleCapture, Call, Generation};
use crate::pool::SidecarPool;
use crate::workers::{Clock, ClockMock};

use super::super::calls::{bundle, call, css, render};
use super::super::support::{Gate, Harness, Hook};

pub(super) fn paired(hook: Hook) -> Harness {
    paired_clock(
        hook,
        Arc::new(
            Unimock::new(ClockMock::now_ms.each_call(matching!()).returns(100_u64))
                .no_verify_in_drop(),
        ),
    )
}

pub(super) fn paired_clock(hook: Hook, clock: Arc<dyn Clock>) -> Harness {
    let hold = Arc::new(Gate::default());
    let held = hold.clone();
    let harness = Harness::clocked(
        2,
        Arc::new(move |event| {
            if *event == call(0, "pair hold") {
                held.block();
            }
            hook(event)
        }),
        clock,
    );
    harness.head("old", &[]);
    harness.pool.head_published();
    let pool = harness.pool.clone();
    let busy = thread::spawn(move || pool.request(css("/head", "pair hold")).unwrap());
    hold.entered();
    harness.pool.request(render("old", "second")).unwrap();
    hold.open();
    busy.join().unwrap();
    harness
}

pub(super) fn edit(generation: &str) -> Call {
    let Call::Bundle(mut request) = bundle(generation) else {
        unreachable!()
    };
    request.capture = Some(BundleCapture::ServeEdit);
    Call::Bundle(request)
}

pub(super) fn start(harness: &Harness, generation: &str) {
    harness.pool.schedule_head_return();
    harness.pool.begin_head_attempt("current");
    harness.pool.request(edit(generation)).unwrap();
}

pub(super) fn step(harness: &Harness) -> bool {
    harness.pool.maintain_head_preparation().unwrap()
}

pub(super) fn finish(harness: &Harness) {
    while step(harness) {}
}

pub(super) fn describe(harness: &Harness, generation: &str) {
    harness
        .pool
        .request(Call::Describe(Generation {
            generation: generation.into(),
        }))
        .unwrap();
}
