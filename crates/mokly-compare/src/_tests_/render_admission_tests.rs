//! Admission retains nested activity and validates the readiness query's epoch.

use std::sync::{Arc, Mutex};

use mokly_graph::write_activity::{WriteActivity, WriteLease, WriteReadinessMock};
use unimock::{MockFn, Unimock, matching};

use crate::render_admission::Admission;

#[test]
fn completed_changes_cannot_clear_nested_activity_or_accept_a_stale_ready_query() {
    let admission = Arc::new(Admission::new(true));
    assert!(!admission.status().2);
    {
        let _outer = admission.enter();
        {
            let _inner = admission.enter();
            admission.resume();
            assert!(
                !admission.status().2,
                "completion must preserve nested suppression"
            );
        }
        assert!(
            !admission.status().2,
            "one lease cannot release another lease's pause"
        );
    }
    assert!(admission.status().2);
    let lease = Arc::new(Mutex::new(None::<Box<dyn WriteLease>>));
    let captured = lease.clone();
    let activity = Arc::downgrade(&admission);
    admission.bind(Arc::new(Unimock::new(
        WriteReadinessMock::ready
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                *captured.lock().unwrap() = Some(activity.upgrade().unwrap().enter());
                captured.lock().unwrap().take();
                true
            })),
    )));
    assert!(
        !admission.status().2,
        "adoption during a ready query must invalidate its permission"
    );
    lease.lock().unwrap().take();
    admission.close();
    assert!(!admission.ready());
}
