//! A cancelled checkout removes the extraction's partial destination.

use std::fs;
use std::io::Write;
use std::sync::Arc;

use mokly_git::command::{Cancellation, Output, Request, Runner};
use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::error::{Error, Result};
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;
#[expect(
    dead_code,
    reason = "the shared fixture also supports repository integration tests"
)]
mod support;

struct CancelledCopy {
    runner: Arc<dyn Runner>,
}
impl Runner for CancelledCopy {
    fn run(&self, request: &Request) -> Result<Output> {
        self.runner.run(request)
    }
    fn digest(&self, request: &Request) -> Result<String> {
        self.runner.digest(request)
    }
    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
    ) -> Result<Output> {
        self.runner.run_cancellable(request, cancellation)
    }
    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()> {
        self.runner.copy(request, output, bytes)
    }
    fn run_cancellable_with_environment_timeout(
        &self,
        _request: &Request,
        _cancellation: &dyn Cancellation,
        _environment: &[(&str, std::ffi::OsString)],
        _timeout: std::time::Duration,
    ) -> Result<Output> {
        Err(Error::Cancelled)
    }
}

#[test]
fn cancellation_during_checkout_removes_the_partial_destination() {
    let fixture = support::Fixture::new();
    fs::File::create(fixture.root().join("large.bin"))
        .unwrap()
        .set_len(49 * 1024 * 1024)
        .unwrap();
    let base = fixture.commit();
    let target = fixture.root().join("partial");
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(CancelledCopy {
            runner: support::runner(Arc::new(Token::default())),
        }),
        disk: Arc::new(SystemDisk),
    };
    let repository = repositories.open(fixture.root()).unwrap();
    assert!(matches!(
        repository.extract(&base, &target, Limits::default()),
        Err(Error::Cancelled)
    ));
    assert!(!target.exists());
}
