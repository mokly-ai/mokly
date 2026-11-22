//! Releases happen once per child lifetime, including a legitimate lazy restart.

use std::sync::{Arc, Mutex, mpsc};

use mokly_sidecar::pool::PoolMock;
use unimock::{MockFn, Unimock, matching};

use crate::leases::ContextLease;

#[test]
fn retiring_a_used_context_and_dropping_its_lease_release_only_once() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let recorded = calls.clone();
    let (released, notices) = mpsc::channel();
    {
        let lease = ContextLease::new(
            "used".into(),
            "configuration".into(),
            Arc::new(Unimock::new(
                PoolMock::release_context
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, context| {
                        recorded.lock().unwrap().push(context.to_owned());
                    }))
                    .at_least_times(0),
            )),
            released,
        );
        lease.begin_use();
        lease.retire();
        lease.retire();
        lease.finish_preparation();
        let observed = calls.lock().unwrap().clone();
        assert_eq!(observed, ["used"]);
    }
    let observed = calls.lock().unwrap().clone();
    assert_eq!(observed, ["used"]);
    assert_eq!(notices.try_iter().collect::<Vec<_>>(), ["used"]);
}

#[test]
fn an_unused_release_allows_one_later_lazy_lifetime_to_release_on_drop() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let recorded = calls.clone();
    let (released, notices) = mpsc::channel();
    {
        let lease = ContextLease::new(
            "lazy".into(),
            "configuration".into(),
            Arc::new(Unimock::new(
                PoolMock::release_context
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, context| {
                        recorded.lock().unwrap().push(context.to_owned());
                    })),
            )),
            released,
        );
        assert_eq!(lease.prepare("postcss.mjs".into()).unwrap().context, "lazy");
        lease.finish_preparation();
        lease.finish_preparation();
        let observed = calls.lock().unwrap().clone();
        assert_eq!(observed, ["lazy"]);
        lease.begin_use();
    }
    let observed = calls.lock().unwrap().clone();
    assert_eq!(observed, ["lazy", "lazy"]);
    assert_eq!(notices.try_iter().collect::<Vec<_>>(), ["lazy", "lazy"]);
}
