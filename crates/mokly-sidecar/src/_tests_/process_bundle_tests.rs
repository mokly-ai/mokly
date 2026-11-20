//! Bundle provenance counts request-local compiler events from the real client loop.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex};

use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::client::{Client, TransportMock};
use crate::compiled_fixture::compiled;
use crate::methods::{Bundle, BundleRequest, Call};
use crate::operations::Operation;
use crate::postcss_phase::PhaseState;
use crate::process_transport::Deadlines;
use crate::process_worker::{ForwardEvents, ProcessWorker};
use crate::results;
use crate::wire::{Event, Frame, Request, Response};
use crate::workers::{ClockMock, DiagnosticsMock, Worker};

fn response(id: u64) -> Frame {
    Frame::Response(Response::Success {
        id,
        result: to_raw_value(&results::Bundle {
            plan: None,
            generation: "bundle".into(),
            compiled: Arc::new(compiled("bundle")),
            epoch: 0,
            cache: None,
            compile_count: 0,
            modules: vec![],
            unmapped_dependency_directories: None,
        })
        .unwrap(),
    })
}

fn operation(operation: Operation) -> Frame {
    Frame::Event(Event::Operation { operation, pid: 7 })
}

#[test]
fn bundle_compile_counts_reset_and_include_each_esbuild_event() {
    let frames = Mutex::new(VecDeque::from([
        operation(Operation::Esbuild),
        operation(Operation::PostcssStart),
        operation(Operation::Esbuild),
        Frame::Event(Event::Diagnostic {
            message: "consumer output".into(),
        }),
        response(1),
        operation(Operation::PostcssStop),
        response(2),
        operation(Operation::Esbuild),
        response(3),
    ]));
    let forwarded = Arc::new(Mutex::new(Vec::new()));
    let observed = forwarded.clone();
    let mock = Unimock::new((
        ClockMock::now_ms.each_call(matching!()).returns(100_u64),
        TransportMock::send
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        TransportMock::receive
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                Ok(frames.lock().unwrap().pop_front().unwrap())
            })),
        DiagnosticsMock::operation
            .each_call(matching!(_, 7))
            .answers_arc(Arc::new(move |_, operation, _| {
                observed.lock().unwrap().push(operation);
            })),
        DiagnosticsMock::emit
            .some_call(matching!("consumer output"))
            .returns(()),
    ));
    let phases = PhaseState::default();
    let compile_count = Arc::new(AtomicU64::new(0));
    let mut worker = ProcessWorker {
        diagnostics: Arc::new(mock.clone()),
        client: Box::new(Client::new(
            Box::new(mock.clone()),
            Box::new(ForwardEvents {
                diagnostics: Arc::new(mock.clone()),
                phases: phases.clone(),
                compile_count: compile_count.clone(),
            }),
            "fixture".into(),
        )),
        clock: Arc::new(mock),
        memory: Arc::new(Unimock::new(())),
        discover_memory: Arc::new(AtomicBool::new(false)),
        deadlines: Arc::new(Deadlines {
            absolute: AtomicU64::new(0),
            duration: AtomicU64::new(0),
        }),
        phases,
        compile_count,
    };
    let mut counts = Vec::new();
    for id in 1..=3 {
        let bundle = worker
            .request(
                &Request {
                    id,
                    quiet: false,
                    call: Call::Bundle(BundleRequest {
                        plan: None,
                        params: Bundle {
                            vite: false,
                            evaluation: None,
                            entry_files: vec!["entry.ts".into()],
                            renderer: None,
                            stories_files: vec![],
                            source_root: "/repo".into(),
                            configuration_directory: ".".into(),
                            repository_roots: vec![],
                            module_resolution: Default::default(),
                        },
                        capture: None,
                    }),
                },
                1000,
            )
            .unwrap()
            .into_bundle();
        counts.push(bundle.compile_count);
    }
    assert_eq!(counts, [2, 0, 1]);
    assert_eq!(
        *forwarded.lock().unwrap(),
        [
            Operation::Esbuild,
            Operation::PostcssStart,
            Operation::Esbuild,
            Operation::PostcssStop,
            Operation::Esbuild
        ]
    );
}
