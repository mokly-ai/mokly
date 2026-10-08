//! Cancellable process groups with concurrent stdout and stderr streaming.

use std::fmt;
use std::io::{Read, Write};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use crate::child_environment::SECRET_VARIABLES;
use crate::remote::contracts::{Clock, Interrupt, LogSink, Logs, Output};
use crate::remote::error::{Error, Operation, Result};

/// One shell-free request; secret input never belongs to the argument list.
pub(crate) struct Request {
    /// Executable name.
    pub(crate) program: String,
    /// Non-secret arguments.
    pub(crate) args: Vec<String>,
    /// Workspace directory.
    pub(crate) cwd: PathBuf,
    /// Responsible boundary.
    pub(crate) operation: Operation,
    /// Optional private stdin bytes.
    pub(crate) input: Option<String>,
    /// Optional streamed output path.
    pub(crate) log: Option<PathBuf>,
    /// Whether the command must stop after an interrupt.
    pub(crate) cancellable: bool,
    /// Whether this is a Blacksmith invocation.
    pub(crate) blacksmith: bool,
}

impl fmt::Debug for Request {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Request")
            .field("program", &self.program)
            .field("args", &self.args)
            .field("input", &self.input.as_ref().map(|_| "<redacted>"))
            .field("log", &self.log)
            .finish()
    }
}

/// Process creation, output and termination seam.
#[cfg_attr(test, unimock::unimock(api = [ProcessExecuteMock]))]
pub(crate) trait Process: Send + Sync {
    /// Execute or stream one request and retain its real termination status.
    fn execute(&self, request: &Request) -> Result<Output>;
}

/// OS process implementation with injected polling, signal and log boundaries.
pub(crate) struct SystemProcess {
    /// Cancellation state.
    pub(crate) interrupt: Arc<dyn Interrupt + Send + Sync>,
    /// Poll wait and time source.
    pub(crate) clock: Arc<dyn Clock + Send + Sync>,
    /// Stream destination factory.
    pub(crate) logs: Arc<dyn Logs + Send + Sync>,
}

impl Process for SystemProcess {
    fn execute(&self, request: &Request) -> Result<Output> {
        if request.cancellable && self.interrupt.requested() {
            return Err(Error::Cancelled);
        }
        let sink = match &request.log {
            Some(path) => Some(self.logs.open(path)?),
            None => None,
        };
        let mut command = build_command(request);
        let mut child = system(command.spawn(), request.operation)?;
        let stdout = match child.stdout.take() {
            Some(stream) => stream,
            None => {
                self.terminate(&mut child);
                let _ = child.wait();
                return Err(Error::Pipe);
            }
        };
        let stderr = match child.stderr.take() {
            Some(stream) => stream,
            None => {
                self.terminate(&mut child);
                let _ = child.wait();
                return Err(Error::Pipe);
            }
        };
        let failed = AtomicBool::new(false);
        thread::scope(|scope| {
            let first_sink = sink.clone();
            let first =
                scope.spawn(|| self.read(Box::new(stdout), first_sink, request.operation, &failed));
            let second =
                scope.spawn(|| self.read(Box::new(stderr), sink, request.operation, &failed));
            if let Some(input) = &request.input {
                let written = match child.stdin.take() {
                    Some(mut stdin) => system(stdin.write_all(input.as_bytes()), request.operation),
                    None => Err(Error::Pipe),
                };
                if let Err(error) = written {
                    self.terminate(&mut child);
                    let _ = child.wait();
                    return Err(error);
                }
            }
            let status = self.wait(&mut child, request, &failed);
            let stdout = match first.join() {
                Ok(output) => output?,
                Err(_) => return Err(Error::Worker),
            };
            let stderr = match second.join() {
                Ok(output) => output?,
                Err(_) => return Err(Error::Worker),
            };
            let mut output = Output {
                stdout,
                stderr,
                code: status?.code(),
            };
            if let Some(secret) = &request.input {
                output.stdout = output.stdout.replace(secret, "<redacted>");
                output.stderr = output.stderr.replace(secret, "<redacted>");
            }
            Ok(output)
        })
    }
}

impl SystemProcess {
    /// Poll while allowing interrupts to terminate the full child group.
    fn wait(
        &self,
        child: &mut Child,
        request: &Request,
        failed: &AtomicBool,
    ) -> Result<std::process::ExitStatus> {
        loop {
            if failed.load(Ordering::SeqCst) || (request.cancellable && self.interrupt.requested())
            {
                self.terminate(child);
                return system(child.wait(), request.operation);
            }
            match system(child.try_wait(), request.operation) {
                Ok(Some(status)) => return Ok(status),
                Ok(None) => {}
                Err(error) => {
                    self.terminate(child);
                    let _ = child.wait();
                    return Err(error);
                }
            }
            self.clock.sleep();
        }
    }
    /// Kill a process group so SSH and rsync children cannot stay active.
    fn terminate(&self, child: &mut Child) {
        #[cfg(unix)]
        {
            let _ = kill_command(child.id()).status();
        }
        let _ = child.kill();
    }

    /// Read one stream into its log or a bounded-lived capture buffer.
    fn read(
        &self,
        mut stream: Box<dyn Read + Send>,
        sink: Option<Arc<dyn LogSink + Send + Sync>>,
        operation: Operation,
        failed: &AtomicBool,
    ) -> Result<String> {
        let mut captured = Vec::new();
        let mut buffer = [0; 8192];
        loop {
            let size = match system(stream.read(&mut buffer), operation) {
                Ok(size) => size,
                Err(error) => {
                    failed.store(true, Ordering::SeqCst);
                    return Err(error);
                }
            };
            if size == 0 {
                break;
            }
            if let Some(sink) = &sink {
                if let Err(error) = sink.write(&buffer[..size]) {
                    failed.store(true, Ordering::SeqCst);
                    return Err(error);
                }
            } else {
                captured.extend_from_slice(&buffer[..size]);
            }
        }
        Ok(String::from_utf8_lossy(&captured).into_owned())
    }
}

/// Configure a request without starting it or reading ambient state.
fn build_command(request: &Request) -> Command {
    let mut command = Command::new(&request.program);
    command
        .args(&request.args)
        .current_dir(&request.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(if request.input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        });
    if request.blacksmith {
        command.env("BLACKSMITH_DISABLE_AUTO_UPDATE", "1");
    }
    #[cfg(unix)]
    command.process_group(0);
    for name in SECRET_VARIABLES {
        command.env_remove(name);
    }
    command
}

/// Configure a process-group stop without starting the helper.
#[cfg(unix)]
fn kill_command(pid: u32) -> Command {
    let mut command = Command::new("kill");
    command
        .args(["-KILL", "--", &format!("-{pid}")])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    for name in SECRET_VARIABLES {
        command.env_remove(name);
    }
    command
}

/// Preserve the typed OS cause for this operation.
fn system<T>(result: std::io::Result<T>, operation: Operation) -> Result<T> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(Error::Io { operation, source }),
    }
}

#[cfg(test)]
#[path = "_tests_/process_command_tests.rs"]
mod process_command_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/process_adapter_support.rs"]
mod process_adapter_support;

#[cfg(all(test, unix))]
#[path = "_tests_/process_io_adapter_tests.rs"]
mod process_io_adapter_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/process_interrupt_adapter_tests.rs"]
mod process_interrupt_adapter_tests;
