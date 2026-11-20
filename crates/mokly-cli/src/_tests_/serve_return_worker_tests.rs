//! A bounded wake defers to admission and an idle driver owns no pool.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mokly_sidecar::pool::{PoolMock, ReturnWake, SidecarPool};
use unimock::{MockFn, Unimock, matching};

use super::{ReturnAdmission, ReturnAdmissionMock, start};

#[test]
fn waiting_base_admission_defers_maintenance_without_retaining_the_pool() {
    let allowed = Arc::new(AtomicBool::new(false));
    let admission_state = allowed.clone();
    let admission = Unimock::new(
        ReturnAdmissionMock::ready
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| admission_state.load(Ordering::SeqCst))),
    );
    let admission: Arc<dyn ReturnAdmission> = Arc::new(admission);
    let calls = Arc::new(AtomicUsize::new(0));
    let observed = calls.clone();
    let mock = Unimock::new(
        PoolMock::maintain_head_return
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                observed.fetch_add(1, Ordering::SeqCst);
                Ok(false)
            }))
            .at_least_times(0),
    );
    let pool: Arc<dyn SidecarPool> = Arc::new(mock.clone());
    let weak = Arc::downgrade(&pool);
    let worker = start(&pool, Arc::downgrade(&admission));
    worker.notify();
    worker.synchronize();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    allowed.store(true, Ordering::SeqCst);
    worker.notify();
    worker.synchronize();
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    drop(pool);
    assert!(weak.upgrade().is_none());
}
