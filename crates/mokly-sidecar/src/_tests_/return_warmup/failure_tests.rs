//! A failed warm-up call ends the warm-up and keeps the process unless a request would lose it.

use std::sync::Arc;

use crate::error::{Error, RemoteCode, RequestCode};
use crate::pool::SidecarPool;

use super::calls::{call, views};
use super::support::{Event, Harness};

/// A case names the failure, builds it, and gives the expected kills and whether the slot stays.
type Case = (&'static str, fn() -> Error, &'static [Event], bool);

#[test]
fn a_failed_warm_up_call_ends_the_warm_up_without_retiring_a_reusable_process() {
    let cases: [Case; 2] = [
        (
            "reusable remote failure",
            || Error::Remote {
                code: RemoteCode::Request(RequestCode::BundleFailed),
                message: "injected".into(),
            },
            &[],
            true,
        ),
        ("crash", || Error::Crashed, &[Event::Kill(2)], false),
    ];
    for (name, failure, kills, kept) in cases {
        let harness = Harness::new(
            1,
            Arc::new(move |event| {
                if *event == call(2, "cssModules g") {
                    return Err(failure());
                }
                Ok(())
            }),
        );
        harness.head("g", &views("view", 2));
        harness.base();
        harness.returned();
        let steps = harness.maintain();
        let killed = harness
            .events
            .read()
            .into_iter()
            .filter(|event| *event == Event::Kill(2))
            .collect::<Vec<_>>();
        let (live, retired) = {
            let state = harness.pool.lock();
            (state.slots[0].is_some(), state.retired.len())
        };
        let failed = harness.events.calls(2);
        harness.pool.abort().unwrap();
        assert_eq!(steps, 1, "{name}");
        assert_eq!(failed, ["restoreGeneration g", "cssModules g"], "{name}");
        assert_eq!(killed, kills, "{name}");
        assert_eq!((live, retired), (kept, 0), "{name}");
    }
}
