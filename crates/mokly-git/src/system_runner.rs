//! Public runner operations select supervised capture, hash, or bounded-copy modes.

use std::ffi::OsString;
use std::io::Write;
use std::time::Duration;

use crate::checkout_bounds::filter_failed;
use crate::command::{self, Output, Request, Runner};
use crate::error::{Error, Result};
use crate::system::{OutputMode, SystemRunner};

impl Runner for SystemRunner {
    fn checkpoint(&self) -> Result<()> {
        if self.cancellation.cancelled() {
            Err(Error::Cancelled)
        } else {
            Ok(())
        }
    }
    fn run(&self, request: &Request) -> Result<Output> {
        self.execute(request, None, OutputMode::Capture, &[], None)
    }

    fn digest(&self, request: &Request) -> Result<String> {
        let output = self.execute(request, None, OutputMode::Digest, &[], None)?;
        match String::from_utf8(output.stdout) {
            Ok(digest) => Ok(digest),
            Err(_) => Err(Error::MalformedOutput),
        }
    }

    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()> {
        self.execute(request, None, OutputMode::Copy(output, bytes), &[], None)?;
        Ok(())
    }

    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
    ) -> Result<Output> {
        self.execute(request, Some(cancellation), OutputMode::Capture, &[], None)
    }

    fn digest_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, OsString)],
        timeout: Duration,
    ) -> Result<String> {
        let output = self.execute(
            request,
            Some(cancellation),
            OutputMode::Digest,
            environment,
            Some(timeout),
        )?;
        if filter_failed(&output.stderr) {
            return Err(Error::CheckoutFailed {
                stderr: output.stderr,
            });
        }
        match String::from_utf8(output.stdout) {
            Ok(hash) => Ok(hash),
            Err(_) => Err(Error::MalformedOutput),
        }
    }

    fn stream_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, OsString)],
        timeout: Duration,
        output: &mut (dyn Write + Send),
        limit: usize,
    ) -> Result<()> {
        let result = self.execute(
            request,
            Some(cancellation),
            OutputMode::BoundedCopy(output, limit),
            environment,
            Some(timeout),
        )?;
        if filter_failed(&result.stderr) {
            return Err(Error::CheckoutFailed {
                stderr: result.stderr,
            });
        }
        Ok(())
    }

    fn run_cancellable_with_environment(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, OsString)],
    ) -> Result<Output> {
        self.execute(
            request,
            Some(cancellation),
            OutputMode::Capture,
            environment,
            None,
        )
    }

    fn run_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, OsString)],
        timeout: Duration,
    ) -> Result<Output> {
        self.execute(
            request,
            Some(cancellation),
            OutputMode::Capture,
            environment,
            Some(timeout),
        )
    }
}
