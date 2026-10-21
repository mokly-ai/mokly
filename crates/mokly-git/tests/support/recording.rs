//! Forward every runner option and retain complete requests for fetch assertions.

use std::ffi::OsString;
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_git::command::{Cancellation, Output, Request, Runner};
use mokly_git::error::Result;

pub struct Recorded {
    pub inner: Arc<dyn Runner>,
    pub requests: Mutex<Vec<Request>>,
}

impl Recorded {
    fn record(&self, request: &Request) {
        self.requests.lock().unwrap().push(request.clone());
    }
}

impl Runner for Recorded {
    fn checkpoint(&self) -> Result<()> {
        self.inner.checkpoint()
    }
    fn run(&self, request: &Request) -> Result<Output> {
        self.record(request);
        self.inner.run(request)
    }
    fn digest(&self, request: &Request) -> Result<String> {
        self.record(request);
        self.inner.digest(request)
    }
    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()> {
        self.record(request);
        self.inner.copy(request, output, bytes)
    }
    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
    ) -> Result<Output> {
        self.record(request);
        self.inner.run_cancellable(request, cancellation)
    }
    fn stream_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, std::ffi::OsString)],
        timeout: std::time::Duration,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<()> {
        self.record(request);
        self.inner.stream_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
            output,
            limit,
        )
    }
    fn run_cancellable_with_environment(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, OsString)],
    ) -> Result<Output> {
        self.record(request);
        self.inner
            .run_cancellable_with_environment(request, cancellation, environment)
    }
    fn run_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, OsString)],
        timeout: Duration,
    ) -> Result<Output> {
        self.record(request);
        self.inner.run_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
        )
    }
    fn digest_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn Cancellation,
        environment: &[(&str, OsString)],
        timeout: Duration,
    ) -> Result<String> {
        self.record(request);
        self.inner.digest_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
        )
    }
}
