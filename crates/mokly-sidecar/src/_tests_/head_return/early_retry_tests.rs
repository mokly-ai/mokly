//! Failed early cleanup preserves the one remaining runtime retry.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::bundle_store::{BundleStoreMock, ReadMiss, ReadOutcome};
use crate::early_lease::EarlyCall;
use crate::error::Error;
use crate::pool::SidecarPool;

use super::process::Mode;
use super::support::{Event, Harness, bundle};

#[test]
fn a_timeout_with_failed_reap_keeps_only_one_ordinary_retry_and_its_error() {
    let loads = Arc::new(AtomicUsize::new(0));
    let loaded = loads.clone();
    let store = Unimock::new(
        BundleStoreMock::load
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                loaded.fetch_add(1, Ordering::SeqCst);
                ReadOutcome::Miss(ReadMiss::Absent)
            })),
    );
    let mut harness = Harness::fault(
        3,
        &[Mode::IdleShutdown, Mode::RetiredTimeout, Mode::Timeout],
        Event::Reap(1),
    );
    harness.pool.request(bundle("/head", "head")).unwrap();
    Arc::get_mut(&mut harness.pool).unwrap().bundle_store = Some(Arc::new(store.clone()));
    let call = bundle("/base", "base");
    let lease = harness.pool.try_early(&call).unwrap().unwrap();
    let first = lease.request(call.clone());
    let failure = match first {
        EarlyCall::Retry(failure) => Some(failure),
        _ => None,
    };
    assert!(matches!(
        failure.as_ref().map(|retry| &retry.failure),
        Some(Error::RequestTimeout {
            deadline_ms: 120_000,
            phase: None,
            ..
        })
    ));
    let cleanup = lease.finish();
    let retried = harness.pool.retry(call, failure.unwrap());
    let events = harness.events.read();
    harness.pool.shutdown().unwrap();
    assert!(
        matches!(cleanup, Err(Error::HeadReturnDisabled { source }) if matches!(source.as_ref(), Error::Unavailable { part } if part == "injected"))
    );
    assert!(matches!(
        retried,
        Err(Error::RequestTimeout {
            deadline_ms: 120_000,
            phase: None,
            ..
        })
    ));
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, Event::Request(_, value) if value == "base"))
            .cloned()
            .collect::<Vec<_>>(),
        [
            Event::Request(1, "base".into()),
            Event::Request(2, "base".into())
        ]
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| **event == Event::Reap(1))
            .count(),
        1
    );
    assert_eq!(loads.load(Ordering::SeqCst), 1);
}
