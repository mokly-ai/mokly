//! A cancelled streamed blob removes the extraction's partial destination.

use std::fs;
use std::io::Write;
use std::sync::Arc;

use mokly_git::command::{Cancellation, Output, Request, Runner};
use mokly_git::control::Token;
use mokly_git::disk::SystemDisk;
use mokly_git::error::{Error, Result};
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::tree::Limits;
use unimock::{MockFn, Unimock, matching};

#[expect(
    dead_code,
    reason = "stream cancellation uses its own repository adapter"
)]
mod support;

#[unimock::unimock(api = CopyMock)]
trait Copy: Send + Sync {
    fn copy(&self, request: &Request, writer: &mut (dyn Write + Send), bytes: usize) -> Result<()>;
}
struct CancelledCopy {
    runner: Arc<dyn Runner>,
    copy: Box<dyn Copy>,
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
        self.copy.copy(request, output, bytes)
    }
}

#[test]
fn cancellation_after_a_written_prefix_removes_the_partial_destination() {
    let fixture = support::Fixture::new();
    fs::File::create(fixture.root().join("large.bin"))
        .unwrap()
        .set_len(49 * 1024 * 1024)
        .unwrap();
    let base = fixture.commit();
    let target = fixture.root().join("partial");
    let observed = target.clone();
    let copy = Unimock::new(
        CopyMock::copy
            .next_call(matching!(_, _, 51_380_224))
            .answers_arc(Arc::new(move |_, _, writer, _| {
                writer.write_all(b"partial bytes").unwrap();
                writer.flush().unwrap();
                assert_eq!(
                    fs::read(observed.join("large.bin")).unwrap(),
                    b"partial bytes"
                );
                Err(Error::Cancelled)
            })),
    );
    let repositories: &dyn Repositories = &GitRepositories {
        runner: Arc::new(CancelledCopy {
            runner: support::runner(Arc::new(Token::default())),
            copy: Box::new(copy),
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
