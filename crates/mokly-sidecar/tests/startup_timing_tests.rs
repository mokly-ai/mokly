//! A real child with mocked group attachment reproduces partial-startup retirement.

use std::path::PathBuf;
use std::sync::Arc;

use mokly_platform::error::Error;
use mokly_platform::processes::ProcessGroupsMock;
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::{Diagnostics, WorkerFactory};
use unimock::{MockFn, Unimock, matching};

#[path = "../src/_tests_/trace_capture.rs"]
mod trace_capture;

struct Quiet;
impl Diagnostics for Quiet {
    fn emit(&self, _: &str) {}
}

#[test]
fn failed_group_attachment_retires_the_created_child_under_spawn() {
    let groups = Unimock::new((
        ProcessGroupsMock::configure
            .next_call(matching!(_))
            .returns(Ok(())),
        ProcessGroupsMock::attach
            .next_call(matching!(_))
            .answers(&|_, _| {
                Err(Error::Locked {
                    path: "private-root".into(),
                })
            }),
    ));
    let trace = trace_capture::Trace::default();
    tracing::subscriber::with_default(trace.clone(), || {
        let span = tracing::info_span!("sidecar.spawn", status = "error");
        let _scope = span.enter();
        let factory = NodeFactory::new(
            Arc::new(groups.clone()),
            Arc::new(SystemClock::default()),
            Arc::new(Quiet),
            Arc::new(SystemMemory),
        );
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        assert!(
            factory
                .spawn(&Launch {
                    node: "node".into(),
                    entry: root.join("tests/fixtures/sidecar/shutdown-tail.mjs"),
                    repository: root,
                    version: "test".into(),
                })
                .is_err()
        );
    });
    let stops = trace.stopped();
    assert_eq!(stops.len(), 1);
    assert_eq!(stops[0].parent.as_ref().unwrap().into_u64(), 1);
    assert_eq!(stops[0].fields["reason"], "retry");
    assert_eq!(stops[0].fields["status"], "ok");
}
