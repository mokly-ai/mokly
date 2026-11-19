//! Deadlines are captured once per call and do not grow with diagnostic traffic.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::client::ClientMock;
use crate::methods::{Call, Empty, ProcessCss};
use crate::postcss_phase::PhaseState;
use crate::process_control::ProcessControl;
use crate::process_memory::MemoryMock;
use crate::process_transport::Deadlines;
use crate::process_worker::ProcessWorker;
use crate::wire::{MethodResult, Request};
use crate::workers::{ClockMock, Worker, WorkerControl};

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
        diagnostics: Arc::new(Unimock::new(())),
        client: Box::new(mock.clone()),
        clock: Arc::new(mock),
        memory: Arc::new(Unimock::new(())),
        discover_memory: Arc::new(AtomicBool::new(false)),
        deadlines,
        phases: PhaseState::default(),
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

#[test]
fn admission_discovers_postcss_children_without_consuming_the_worker_scan() {
    let scans = Arc::new(Mutex::new(Vec::new()));
    let recorded = scans.clone();
    let mock = Unimock::new((
        ClockMock::now_ms.each_call(matching!()).returns(100_u64),
        ClientMock::request
            .some_call(matching!(_))
            .returns(Ok(MethodResult::Empty)),
        MemoryMock::resident_bytes
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, discover| {
                recorded.lock().unwrap().push(discover);
                Ok(200)
            })),
        ProcessGroupMock::kill
            .some_call(matching!())
            .returns(Ok(())),
    ));
    let discover_memory = Arc::new(AtomicBool::new(false));
    let (outgoing, _frames) = mpsc::sync_channel(1);
    let (_exited_sender, exited) = mpsc::sync_channel(1);
    let (_drained_sender, drained) = mpsc::sync_channel(1);
    let control = ProcessControl {
        memory: Arc::new(mock.clone()),
        discover_memory: discover_memory.clone(),
        startup: Default::default(),
        group: Box::new(mock.clone()),
        outgoing,
        exited: Mutex::new(exited),
        drained: Mutex::new(drained),
        clock: Arc::new(mock.clone()),
    };
    let mut worker = ProcessWorker {
        diagnostics: Arc::new(Unimock::new(())),
        client: Box::new(mock.clone()),
        clock: Arc::new(mock.clone()),
        memory: Arc::new(mock.clone()),
        discover_memory,
        deadlines: Arc::new(Deadlines {
            absolute: AtomicU64::new(0),
            duration: AtomicU64::new(0),
        }),
        phases: PhaseState::default(),
    };
    worker
        .request(
            &Request {
                id: 1,
                call: Call::ProcessCss(ProcessCss {
                    repository_roots: vec![],
                    context: "stylesheet".into(),
                    source_root: "/source".into(),
                    module_resolution: Default::default(),
                    postcss: "postcss.cjs".into(),
                    source_path: "style.css".into(),
                    text: String::new(),
                }),
            },
            71,
        )
        .unwrap();
    control.resident_bytes().unwrap();
    control.resident_bytes().unwrap();
    worker.resident_bytes().unwrap();
    control.resident_bytes().unwrap();
    worker.resident_bytes().unwrap();
    assert_eq!(*scans.lock().unwrap(), [true, true, true, false, false]);
}
