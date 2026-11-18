//! One failed background reap leaves only ordinary admission on the other slots.

use crate::early_lease::EarlyCall;
use crate::error::Error;
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Harness, bundle, css};

#[derive(Clone, Copy, Debug)]
enum Site {
    Start,
    End,
    Recycle,
    Return,
}

#[test]
fn a_failed_reap_disables_both_background_paths_and_retires_only_its_slot() {
    for site in [Site::Start, Site::End, Site::Recycle, Site::Return] {
        let mode = if matches!(site, Site::Recycle) {
            Mode::RetiredPressure
        } else {
            Mode::Retired
        };
        let harness = Harness::fault(
            3,
            &[Mode::IdleShutdown, mode, Mode::IdleShutdown],
            Event::Reap(1),
        );
        harness.pool.request(bundle("/head", "head")).unwrap();
        let (failure, called) = match site {
            Site::Start => {
                harness.pool.request(css("/other", "other")).unwrap();
                let lease = harness
                    .pool
                    .try_early(&css("/base", "base"))
                    .unwrap()
                    .unwrap();
                let deferred = matches!(lease.request(css("/base", "base")), EarlyCall::Deferred);
                (lease.finish(), deferred)
            }
            Site::End => {
                let lease = harness
                    .pool
                    .try_early(&css("/base", "base"))
                    .unwrap()
                    .unwrap();
                let called = matches!(
                    lease.request(css("/base", "base")),
                    EarlyCall::Complete(Ok(_))
                );
                (lease.finish(), called)
            }
            Site::Return => {
                harness.pool.request(css("/base", "base")).unwrap();
                harness.pool.schedule_head_return();
                (harness.pool.maintain_head_return().map(|_| ()), true)
            }
            Site::Recycle => {
                let lease = harness
                    .pool
                    .try_early(&css("/base", "base"))
                    .unwrap()
                    .unwrap();
                let first = matches!(
                    lease.request(css("/base", "base")),
                    EarlyCall::Complete(Ok(_))
                );
                let second = matches!(
                    lease.request(css("/base", "base")),
                    EarlyCall::Complete(Ok(_))
                );
                let next = matches!(lease.request(css("/base", "probe")), EarlyCall::Deferred);
                (lease.finish(), first && second && next)
            }
        };
        assert!(called, "{site:?}");
        let disabled = matches!(failure, Err(Error::HeadReturnDisabled { source }) if matches!(source.as_ref(), Error::Unavailable { part } if part == "injected"));
        harness.pool.schedule_head_return();
        let returning = harness.pool.maintain_head_return().unwrap();
        let later = harness.pool.try_early(&css("/base", "later")).unwrap();
        let acquired = later.is_some();
        if let Some(later) = later {
            later.finish().unwrap();
        }
        harness.pool.request(css("/base", "remaining")).unwrap();
        let retired = harness.pool.lock().retired.len();
        let events = harness.events.read();
        harness.pool.shutdown().unwrap();
        assert_eq!(
            (disabled, returning, acquired, retired),
            (true, false, false, 1),
            "site: {site:?}"
        );
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == Event::Reap(1))
                .count(),
            1
        );
        assert_eq!(events.last(), Some(&Event::Request(2, "remaining".into())));
    }
}
