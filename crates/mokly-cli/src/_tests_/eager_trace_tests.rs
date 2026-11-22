//! Readiness closes while an eager task remains blocked on final head evidence.

use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex};

use mokly_cli::redaction::Redactor;
use mokly_graph::cache::MemoryCache;
use mokly_server::changes::ChangeToken;
use mokly_sidecar::workers::ClockMock;
use mokly_test_support::subscriber::with_default;
use serde_json::Value;
use tracing_subscriber::layer::SubscriberExt;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::PreparationAdmission;
use crate::serve_eager_task::{
    NativeTasks, PreparationTasks, PreparationWorkMock, SourceCompletion,
};
use crate::terminal::TerminalMock;

use super::Timings;

#[test]
fn eager_task_does_not_retain_the_readiness_span_while_waiting_for_head() {
    let lines = Arc::new(Mutex::new(Vec::new()));
    let captured = lines.clone();
    let layer = Timings {
        terminal: Arc::new(Unimock::new(
            TerminalMock::stderr
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, line| {
                    captured.lock().unwrap().push(line.to_owned())
                })),
        )),
        session: "test".into(),
        clock: Arc::new(Unimock::new(
            ClockMock::now_ms.each_call(matching!()).returns(0u64),
        )),
        next: AtomicU64::new(1),
        redactor: Arc::new(Redactor::default()),
        cache: Arc::new(MemoryCache::new(0, 0)),
    };
    let closed = with_default(tracing_subscriber::registry().with(layer), || {
        let work = Arc::new(Unimock::new((
            PreparationWorkMock::sources
                .some_call(matching!())
                .returns(SourceCompletion::Head {
                    classification: false,
                }),
            PreparationWorkMock::discard
                .some_call(matching!())
                .returns(()),
            PreparationWorkMock::reader
                .some_call(matching!(_))
                .returns(()),
        )));
        let task = {
            let _ready = tracing::info_span!("serve.ready", status = "ok").entered();
            let tasks: &dyn PreparationTasks = &NativeTasks;
            let task = tasks.start(
                work,
                Arc::new(ChangeToken::default()),
                Arc::new(PreparationAdmission::default()),
            );
            task.sources_ready(Arc::new(ChangeToken::default()));
            task
        };
        let closed = lines.lock().unwrap().iter().any(|line| {
            let record: Value =
                serde_json::from_str(line.strip_prefix("[mokly:timing] ").unwrap()).unwrap();
            record["stage"] == "serve.ready" && record["event"] == "end"
        });
        task.cancel_and_join();
        closed
    });
    assert!(
        closed,
        "readiness must end before the blocked eager owner drains"
    );
}
