//! The return pass keeps its turn, and a failed reap that ends it also ends the preload.

use std::sync::Arc;
use std::thread;

use crate::error::Error;
use crate::pool::SidecarPool;

use super::calls::{call, css, finished, send};
use super::support::{Event, Gate, Harness};

#[test]
fn a_return_step_that_becomes_ready_comes_before_the_next_preload_call() {
    let restore = Arc::new(Gate::default());
    let base = Arc::new(Gate::default());
    let (held_restore, held_base) = (restore.clone(), base.clone());
    let harness = Harness::new(
        3,
        &["/head", "/head", "/base"],
        Arc::new(move |event| {
            if *event == call(1, "restoreGeneration g") {
                held_restore.block();
            }
            if *event == call(2, "base") {
                held_base.block();
            }
            Ok(())
        }),
    );
    harness.describe_head("g");
    let (busy, busy_done) = send(&harness.pool, css("/base", "base"));
    base.entered();
    harness.pool.schedule_head_return();
    let pool = harness.pool.clone();
    let maintenance = thread::spawn(move || pool.maintain_head_return().unwrap());
    restore.entered();
    base.open();
    assert_eq!(finished(&busy_done), Ok(true));
    busy.join().unwrap();
    restore.open();
    assert!(maintenance.join().unwrap());
    let yielded = harness.events.calls(1);
    let returned = harness.pool.maintain_head_return();
    let events = harness.events.read();
    harness.pool.abort().unwrap();
    assert_eq!(yielded, ["restoreGeneration g"]);
    assert!(
        matches!(returned, Err(Error::Unavailable { .. })),
        "{returned:?}"
    );
    assert_eq!(
        events
            .into_iter()
            .skip_while(|event| *event != Event::Kill(2))
            .collect::<Vec<_>>(),
        [Event::Kill(2), Event::Reap(2), Event::Spawn]
    );
}

#[test]
fn a_failed_reap_that_ends_background_return_also_ends_the_preload() {
    let harness = Harness::new(
        3,
        &["/head", "/head", "/base"],
        Arc::new(|event| {
            if *event == Event::Reap(2) {
                return Err(Error::Unavailable {
                    part: "injected reap".into(),
                });
            }
            Ok(())
        }),
    );
    harness.pool.request(css("/base", "base")).unwrap();
    harness.describe_head("g");
    harness.pool.schedule_head_return();
    let disabled = harness.pool.maintain_head_return();
    let after = harness.pool.maintain_head_return().unwrap();
    let calls = harness.events.calls(1);
    harness.pool.abort().unwrap();
    assert!(
        matches!(disabled, Err(Error::HeadReturnDisabled { .. })),
        "{disabled:?}"
    );
    assert!(!after);
    assert_eq!(calls, Vec::<String>::new());
}
