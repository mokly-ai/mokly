//! A failed preload call ends the work for its process under the request failure rule.

use std::sync::Arc;

use crate::error::{Error, RemoteCode, RequestCode};
use crate::pool::SidecarPool;

use super::calls::call;
use super::support::{Event, Harness};

/// A case names the failure, builds it, and gives the expected kills and whether the slot stays.
type Case = (&'static str, fn() -> Error, &'static [Event], bool);

#[test]
fn a_failed_preload_call_ends_the_preload_of_that_process_only() {
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
        ("crash", || Error::Crashed, &[Event::Kill(1)], false),
    ];
    for (name, failure, kills, kept) in cases {
        let harness = Harness::new(
            3,
            &["/head", "/head", "/head"],
            Arc::new(move |event| {
                if *event == call(1, "restoreGeneration g") {
                    return Err(failure());
                }
                Ok(())
            }),
        );
        harness.describe_head("g");
        let steps = harness.maintain();
        let again = harness.maintain();
        let killed = harness
            .events
            .read()
            .into_iter()
            .filter(|event| matches!(event, Event::Kill(_)))
            .collect::<Vec<_>>();
        let (live, retired) = {
            let state = harness.pool.lock();
            (state.slots[1].is_some(), state.retired.len())
        };
        let failed = harness.events.calls(1);
        let prepared = harness.events.calls(2);
        harness.pool.abort().unwrap();
        assert_eq!((steps, again), (2, 0), "{name}");
        assert_eq!(failed, ["restoreGeneration g"], "{name}");
        assert_eq!(prepared, ["restoreGeneration g", "cssModules g"], "{name}");
        assert_eq!(killed, kills, "{name}");
        assert_eq!((live, retired), (kept, 0), "{name}");
    }
}
