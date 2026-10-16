//! Deadlines are captured once per call and do not grow with diagnostic traffic.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use unimock::{MockFn, Unimock, matching};

use crate::client::ClientMock;
use crate::methods::{Call, Empty};
use crate::process_transport::Deadlines;
use crate::process_worker::ProcessWorker;
use crate::wire::{MethodResult, Request};
use crate::workers::{ClockMock, Worker};

#[test]
fn deadline_uses_the_injected_clock_and_the_method_duration() {
    let deadlines = Arc::new(Deadlines {
        absolute: AtomicU64::new(0),
        duration: AtomicU64::new(0),
    });
    let observed = deadlines.clone();
    let mock = Unimock::new((
        ClockMock::now_ms.next_call(matching!()).returns(100_u64),
        ClientMock::request
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                assert_eq!(observed.absolute.load(Ordering::SeqCst), 171);
                assert_eq!(observed.duration.load(Ordering::SeqCst), 71);
                Ok(MethodResult::Empty)
            })),
    ));
    let mut worker = ProcessWorker {
        client: Box::new(mock.clone()),
        clock: Arc::new(mock),
        memory: Box::new(Unimock::new(())),
        discover_memory: AtomicBool::new(false),
        deadlines,
    };
    worker
        .request(
            &Request {
                id: 1,
                call: Call::Shutdown(Empty {}),
            },
            71,
        )
        .unwrap();
}
