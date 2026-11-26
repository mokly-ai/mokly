//! Publication status commands disable optional index locks before spawn.

use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::command::{self, Output, Runner, RunnerMock};
use mokly_git::control::CancellationMock;
use mokly_git::error;
use mokly_git::system::SystemRunner;
use mokly_platform::error::Error::InvalidPath;
use mokly_platform::processes::ProcessGroupsMock;
use unimock::{MockFn, Unimock, matching};

use crate::checkout::{Checkout, GitCheckout};
use crate::error::Error;

#[test]
fn inspect_disables_optional_locks_for_the_status_process() {
    let system = SystemRunner {
        groups: Arc::new(Unimock::new(
            ProcessGroupsMock::configure
                .some_call(matching!(_))
                .answers(&|_, command| {
                    assert_eq!(command.get_args().next(), Some(OsStr::new("status")));
                    assert_eq!(
                        command
                            .get_envs()
                            .find(|(name, _)| *name == "GIT_OPTIONAL_LOCKS")
                            .and_then(|(_, value)| value),
                        Some(OsStr::new("0"))
                    );
                    Err(InvalidPath {
                        path: PathBuf::from("status-process-probe"),
                    })
                }),
        )),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .some_call(matching!())
                .returns(false),
        )),
        clock: Arc::new(Unimock::new(())),
    };
    let runner = Unimock::new((
        RunnerMock::run_cancellable
            .some_call(matching!((request, _) if request.args == ["rev-parse", "--show-toplevel"].map(OsString::from)))
            .returns(Ok(Output { stdout: b"/repo\n".to_vec(), stderr: Vec::new() })),
        RunnerMock::run_cancellable
            .some_call(matching!((request, _) if request.args == ["rev-parse", "--verify", "HEAD^{commit}"].map(OsString::from)))
            .returns(Ok(Output { stdout: format!("{}\n", "a".repeat(40)).into_bytes(), stderr: Vec::new() })),
        RunnerMock::run_cancellable
            .some_call(matching!((request, _) if request.args.first().is_some_and(|arg| arg == "status")))
            .answers_arc(Arc::new(move |_, request, cancellation| system.run_cancellable(request, cancellation))),
    ));
    let checkout: &dyn Checkout = &GitCheckout {
        runner: Arc::new(runner),
        hints: Arc::new(Unimock::new(())),
    };
    let cancellation = Unimock::new(
        command::CancellationMock::is_cancelled
            .some_call(matching!())
            .returns(false),
    );
    assert!(matches!(
        checkout.inspect(Path::new("/repo"), &[], &cancellation),
        Err(Error::Git {
            source: error::Error::Platform {
                source: InvalidPath { path }
            }
        }) if path == Path::new("status-process-probe")
    ));
}
