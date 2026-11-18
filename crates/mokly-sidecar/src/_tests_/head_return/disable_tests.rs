//! One failed background reap disables later passes while healthy requests continue.

use crate::error::Error;
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Harness, bundle, css};

#[test]
fn a_failed_reap_disables_current_and_later_returns_but_keeps_healthy_requests() {
    let harness = Harness::fault(
        3,
        &[
            Mode::Retired,
            Mode::Foreground,
            Mode::IdleShutdown,
            Mode::IdleShutdown,
        ],
        Event::Reap(0),
    );
    harness.pool.request(css("/base-a", "base-a")).unwrap();
    harness.pool.request(css("/base-b", "base-b")).unwrap();
    harness.pool.request(bundle("/head", "useful")).unwrap();
    harness.pool.schedule_head_return();
    let failure = harness.pool.maintain_head_return();
    assert!(
        harness.pool.lock().head.candidates.is_empty(),
        "the first failed reap must end the remaining pass"
    );
    assert!(!harness.pool.maintain_head_return().unwrap());
    harness.pool.request(css("/head", "healthy-head")).unwrap();
    harness.pool.request(css("/base-b", "base-b")).unwrap();
    harness.pool.schedule_head_return();
    assert!(
        harness.pool.lock().head.candidates.is_empty(),
        "a later publication must not start another return pass"
    );
    assert!(!harness.pool.maintain_head_return().unwrap());
    harness.pool.request(css("/base-c", "base-c")).unwrap();
    let events = harness.events.read();
    {
        let state = harness.pool.lock();
        assert_eq!(state.retired.iter().copied().collect::<Vec<_>>(), [0]);
        assert!(!state.stopped);
        assert!(state.controls.contains_key(&0));
        assert_eq!(state.head.warm.as_ref().unwrap().index, 2);
        assert_eq!(
            state.slots[1].as_ref().unwrap().source_root.to_str(),
            Some("/base-c")
        );
        assert_eq!(
            state.slots[2].as_ref().unwrap().source_root.to_str(),
            Some("/head")
        );
    }
    harness.pool.shutdown().unwrap();
    assert!(matches!(&failure, Err(Error::HeadReturnDisabled { source })
        if matches!(source.as_ref(), Error::Unavailable { part } if part == "injected")));
    assert_eq!(
        events
            .into_iter()
            .filter(|event| matches!(event, Event::Kill(_) | Event::Reap(_)))
            .collect::<Vec<_>>(),
        [Event::Kill(0), Event::Reap(0), Event::Kill(1)]
    );
}
