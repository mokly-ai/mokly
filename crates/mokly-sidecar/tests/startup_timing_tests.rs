//! A real child with mocked group attachment reproduces partial-startup retirement.

use std::path::PathBuf;
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::processes::ProcessGroupsMock;
use mokly_sidecar::error::{Error, InternalError};
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::workers::{Diagnostics, SpawnFailure, WorkerFactory};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

#[path = "../src/_tests_/trace_capture.rs"]
mod trace_capture;

struct Quiet;
impl Diagnostics for Quiet {
    fn emit(&self, _: &str) {}
}

fn launch() -> Launch {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    Launch {
        capture_durability: false,
        node: "node".into(),
        entry: root.join("tests/fixtures/sidecar/shutdown-tail.mjs"),
        repository: root,
        version: "test".into(),
    }
}

#[test]
fn failed_configuration_reports_no_child_and_preserves_the_platform_error() {
    let groups = Unimock::new(
        ProcessGroupsMock::configure
            .next_call(matching!(_))
            .answers(&|_, _| {
                Err(error::Error::Locked {
                    path: "private-root".into(),
                })
            }),
    );
    let factory = NodeFactory::new(
        Arc::new(groups),
        Arc::new(SystemClock::default()),
        Arc::new(Quiet),
        Arc::new(SystemMemory),
    );
    let failure = factory.spawn(&launch()).err().unwrap();
    assert!(
        matches!(&failure, SpawnFailure::NotStarted(Error::Internal(InternalError::Platform {
        source: error::Error::Locked { path },
    })) if path == &PathBuf::from("private-root")),
        "{failure:?}"
    );
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
                Err(error::Error::Locked {
                    path: "private-root".into(),
                })
            }),
    ));
    let trace = Trace::default();
    trace.in_scope(|| {
        let span = tracing::info_span!("sidecar.spawn", status = "error");
        let _scope = span.enter();
        let factory = NodeFactory::new(
            Arc::new(groups.clone()),
            Arc::new(SystemClock::default()),
            Arc::new(Quiet),
            Arc::new(SystemMemory),
        );
        let result = factory.spawn(&launch());
        assert!(result.is_err());
        let failure = result.err().unwrap();
        assert!(
            matches!(&failure, SpawnFailure::Started(Error::Internal(InternalError::Platform {
            source: error::Error::Locked { path },
        })) if path == &PathBuf::from("private-root")),
            "{failure:?}"
        );
    });
    let stops = trace.closed("sidecar.stop");
    assert_eq!(stops.len(), 1);
    assert_eq!(stops[0].parent.as_ref().unwrap().into_u64(), 1);
    assert_eq!(stops[0].fields["reason"], "retry");
    assert_eq!(stops[0].fields["status"], "ok");
}
