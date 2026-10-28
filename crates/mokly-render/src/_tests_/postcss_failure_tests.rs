//! A failed PostCSS input fails again for its context, and waiting requests share a lost child.

use std::collections::BTreeSet;
use std::sync::atomic::Ordering;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use mokly_css::error::CssError;
use mokly_css::types::CssProcessor;
use mokly_sidecar::error::Error;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::postcss_failure::PostcssFailure;
use unimock::{MockFn, Unimock, matching};

use crate::postcss::PostCss;

use super::postcss_support::{DEADLINE, css, processor};

#[test]
fn a_failed_input_fails_again_for_its_context_without_another_request() {
    let pool = Arc::new(Unimock::new((
        PoolMock::request.next_call(matching!(_)).answers(&|_, _| {
            Err(Error::Postcss {
                source: PostcssFailure::Plugin {
                    plugin: "fixture".into(),
                    stylesheet: "a.css".into(),
                    detail: "broken".into(),
                },
            })
        }),
        PoolMock::release_context
            .each_call(matching!("context"))
            .returns(()),
    )));
    let processor = processor(pool, Arc::new(Unimock::new(())));
    let first = processor
        .process("a.css", ".a {}", &BTreeSet::new())
        .unwrap_err();
    let second = processor
        .process("a.css", ".a {}", &BTreeSet::new())
        .unwrap_err();
    assert!(matches!(first, CssError::Runtime { .. }));
    assert_eq!(first.to_string(), second.to_string());
}

fn process(processor: &PostCss, path: &str) -> mokly_css::error::Result<String> {
    processor
        .process(path, ".a {}", &BTreeSet::new())
        .map(|processed| processed.text)
}

#[test]
fn waiting_requests_receive_a_lost_child_and_a_later_request_starts_again() {
    let (calling, called) = mpsc::channel();
    let (finish, finished) = mpsc::channel::<()>();
    let finished = Mutex::new(finished);
    let requests = Arc::new(Mutex::new(Vec::new()));
    let recorded = requests.clone();
    let pool = Arc::new(Unimock::new((
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let path = match &call {
                    Call::ProcessCss(params) => params.source_path.clone(),
                    _ => String::new(),
                };
                recorded.lock().unwrap().push(path.clone());
                if path == "a.css" {
                    calling.send(()).unwrap();
                    finished.lock().unwrap().recv_timeout(DEADLINE).unwrap();
                    return Err(Error::RequestTimeout {
                        call: Box::new(call),
                        deadline_ms: 60_000,
                        phase: None,
                    });
                }
                Ok(css(Vec::new()))
            })),
        PoolMock::release_context
            .each_call(matching!("context"))
            .returns(()),
    )));
    let processor = Arc::new(processor(pool, Arc::new(Unimock::new(()))));
    let first = processor.clone();
    let lost = thread::spawn(move || process(&first, "a.css").unwrap_err().to_string());
    called.recv_timeout(DEADLINE).unwrap();
    let second = processor.clone();
    let waiting = thread::spawn(move || process(&second, "b.css").unwrap_err().to_string());
    let deadline = Instant::now() + DEADLINE;
    while processor.turns.tickets.load(Ordering::SeqCst) < 2 {
        assert!(
            Instant::now() < deadline,
            "the second request never took a ticket"
        );
        thread::yield_now();
    }
    finish.send(()).unwrap();
    let lost = lost.join().unwrap();
    assert!(lost.contains("exceeded 60000ms"), "{lost}");
    assert_eq!(waiting.join().unwrap(), lost);
    assert_eq!(process(&processor, "b.css").unwrap(), "a{}");
    assert_eq!(*requests.lock().unwrap(), ["a.css", "b.css"]);
}
