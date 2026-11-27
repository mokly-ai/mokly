//! Readiness closes while an eager task remains blocked on final head evidence.

use std::sync::Arc;

use mokly_server::changes::ChangeToken;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_admission::PreparationAdmission;
use crate::serve_eager_task::{
    NativeTasks, PreparationTasks, PreparationWorkMock, SourceCompletion,
};

use super::serve_trace_tests::capture_live;

#[test]
fn eager_task_does_not_retain_the_readiness_span_while_waiting_for_head() {
    let closed = capture_live(|lines| {
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
