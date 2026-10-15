//! Capture-budget validation before any platform or process operation.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::processes::ProcessGroupsMock;
use unimock::{MockFn, Unimock, matching};

use crate::command::{DEFAULT_OUTPUT_LIMIT, Request, Runner};
use crate::control::CancellationMock;
use crate::error::Error;
use crate::system::SystemRunner;

#[test]
fn oversized_output_limits_fail_before_platform_configuration() {
    for limit in [DEFAULT_OUTPUT_LIMIT + 1, usize::MAX] {
        let runner: &dyn Runner = &SystemRunner {
            clock: Arc::new(Unimock::new(())),
            cancellation: Arc::new(Unimock::new(())),
            groups: Arc::new(Unimock::new(())),
        };
        assert!(matches!(
            runner.run(&request(limit)),
            Err(Error::InvalidOutputLimit { limit: actual, maximum })
                if actual == limit && maximum == DEFAULT_OUTPUT_LIMIT
        ));
    }
}

#[test]
fn limits_at_or_below_the_maximum_reach_the_platform_boundary() {
    for limit in [0, 1, DEFAULT_OUTPUT_LIMIT] {
        let runner: &dyn Runner = &SystemRunner {
            clock: Arc::new(Unimock::new(())),
            cancellation: Arc::new(Unimock::new(
                CancellationMock::cancelled
                    .some_call(matching!())
                    .returns(false),
            )),
            groups: Arc::new(Unimock::new(
                ProcessGroupsMock::configure
                    .next_call(matching!(_))
                    .returns(Err(error::Error::InvalidPath {
                        path: PathBuf::from("platform-probe"),
                    })),
            )),
        };
        assert!(matches!(
            runner.run(&request(limit)),
            Err(Error::Platform { source: error::Error::InvalidPath { path } })
                if path == Path::new("platform-probe")
        ));
    }
}

fn request(limit: usize) -> Request {
    Request {
        directory: PathBuf::from("/checkout"),
        args: vec!["--version".into()],
        stdin: vec![],
        output_limit: limit,
        stderr_limit: 1024 * 1024,
    }
}

#[test]
fn cancelled_commands_do_not_configure_or_spawn_a_process() {
    let runner: &dyn Runner = &SystemRunner {
        clock: Arc::new(Unimock::new(())),
        groups: Arc::new(Unimock::new(())),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(true),
        )),
    };
    assert!(matches!(runner.run(&request(1024)), Err(Error::Cancelled)));
}
