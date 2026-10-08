//! Fake clock records retry inputs without sleeping.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{ClockMillisMock, ClockStampMock, ClockWaitMock};

use super::harness_tests::Case;

pub(super) fn clock(case: Case, events: Arc<Mutex<Vec<String>>>, stuck: bool) -> Arc<Unimock> {
    let stamp = ClockStampMock
        .each_call(matching!())
        .returns("20261006T120000Z".to_owned());
    let millis = ClockMillisMock.each_call(matching!()).returns(1000u128);
    if stuck
        || matches!(
            case,
            Case::RetryStop
                | Case::CompletedOnRetry
                | Case::CompletedOnFinal
                | Case::CleanupWarmup
                | Case::CleanupSuites
                | Case::CleanupFailedSuite
                | Case::InterruptCleanupWarmup
                | Case::InterruptCleanupSuites
        )
    {
        let wait =
            ClockWaitMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, duration| {
                    assert!([Duration::from_secs(5), Duration::from_secs(10)].contains(&duration));
                    events
                        .lock()
                        .unwrap()
                        .push(format!("wait:{}", duration.as_secs()));
                }));
        Arc::new(if case.preparation_fails() {
            Unimock::new((stamp, wait))
        } else {
            Unimock::new((stamp, millis, wait))
        })
    } else {
        Arc::new(if case.preparation_fails() {
            Unimock::new(stamp)
        } else {
            Unimock::new((stamp, millis))
        })
    }
}
