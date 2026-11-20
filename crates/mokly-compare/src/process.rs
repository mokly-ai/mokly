//! Host package-manager processes with owned trees and bounded output pipes.

use std::env;
use std::io::Read;
use std::process::{self, Stdio};
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::{Arc, Mutex, PoisonError};
use std::thread::{self, JoinHandle};

use mokly_git::control::Clock;
use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::commands::{Child, Command, Output, POLL_INTERVAL, STOP_GRACE, Spawner};
use crate::error::{Error, InternalError, IoResult, Result};
use crate::manager_command;
use crate::manager_environment;
use crate::programs::command;

const OUTPUT_LIMIT: usize = 1024 * 1024;

/// Shell-free process adapter, composed with platform process-tree ownership.
pub struct SystemSpawner {
    /// OS process group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
    /// The supervisor's monotonic clock, also used during Drop.
    pub clock: Arc<dyn Clock>,
}

/// Keeps manager reaping off the owner thread and joins only ready readers during polling.
struct OwnedChild {
    process: Mutex<Receiver<Result<process::ExitStatus>>>,
    status: Option<process::ExitStatus>,
    group: Arc<dyn ProcessGroup>,
    clock: Arc<dyn Clock>,
    stdout: Option<JoinHandle<Result<Vec<u8>>>>,
    stderr: Option<JoinHandle<Result<Vec<u8>>>>,
    output: Vec<u8>,
    finished: bool,
}

impl Spawner for SystemSpawner {
    fn spawn(&self, request: &Command) -> Result<Box<dyn Child>> {
        let mut command = command(request)?;
        let variables = manager_command::variables(request);
        // Start each install from an allowed list of variables, not the
        // inherited environment, so no base configuration or lifecycle script
        // receives an inherited secret such as MOKLY_TOKEN or GITHUB_TOKEN.
        // Mokly's own fixed names follow, and the sanitized PATH that
        // `programs` set overrides the inherited one.
        for (inherited, _) in env::vars_os() {
            if !manager_environment::allowed(&inherited) {
                command.env_remove(inherited);
            }
        }
        command
            .envs(variables)
            .args(&request.args)
            .current_dir(&request.directory)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Err(source) = self.groups.configure(&mut command) {
            return Err(InternalError::Platform { source }.into());
        }
        let mut process = match command.spawn() {
            Ok(process) => process,
            Err(_) => return Err(Error::CommandUnavailable),
        };
        let group: Arc<dyn ProcessGroup> = match self.groups.attach(&process) {
            Ok(group) => Arc::from(group),
            Err(source) => {
                let _ = process.kill();
                thread::spawn(move || process.wait());
                return Err(InternalError::Platform { source }.into());
            }
        };
        let (Some(stdout), Some(stderr)) = (process.stdout.take(), process.stderr.take()) else {
            let _ = group.kill();
            thread::spawn(move || process.wait());
            return Err(InternalError::Worker.into());
        };
        let output_group = Arc::clone(&group);
        let error_group = Arc::clone(&group);
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let _ = sender.send(process.wait().base());
        });
        Ok(Box::new(OwnedChild {
            process: Mutex::new(receiver),
            status: None,
            group,
            clock: Arc::clone(&self.clock),
            stdout: Some(thread::spawn(move || {
                capture(stdout, output_group.as_ref())
            })),
            stderr: Some(thread::spawn(move || capture(stderr, error_group.as_ref()))),
            output: Vec::new(),
            finished: false,
        }))
    }
}

impl Child for OwnedChild {
    fn poll(&mut self) -> Result<bool> {
        if self
            .stdout
            .as_ref()
            .is_some_and(|worker| worker.is_finished())
        {
            self.output = join(self.stdout.take())?;
        }
        if self
            .stderr
            .as_ref()
            .is_some_and(|worker| worker.is_finished())
        {
            join(self.stderr.take())?;
        }
        if self.status.is_none() {
            let process = self
                .process
                .get_mut()
                .unwrap_or_else(PoisonError::into_inner);
            match process.try_recv() {
                Ok(result) => self.status = Some(result?),
                Err(TryRecvError::Empty) => {}
                Err(TryRecvError::Disconnected) => return Err(InternalError::Worker.into()),
            }
        }
        Ok(self.status.is_some() && self.stdout.is_none() && self.stderr.is_none())
    }

    fn terminate(&mut self) -> Result<()> {
        match self.group.terminate() {
            Ok(()) => Ok(()),
            Err(source) => Err(InternalError::Platform { source }.into()),
        }
    }

    fn kill(&mut self) -> Result<()> {
        match self.group.kill() {
            Ok(()) => Ok(()),
            Err(source) => Err(InternalError::Platform { source }.into()),
        }
    }

    fn finish(&mut self) -> Result<Output> {
        let status = match self.status {
            Some(status) => status,
            None => {
                let process = self
                    .process
                    .get_mut()
                    .unwrap_or_else(PoisonError::into_inner);
                match process.recv() {
                    Ok(result) => result?,
                    Err(_) => return Err(InternalError::Worker.into()),
                }
            }
        };
        let stdout = if self.stdout.is_some() {
            join(self.stdout.take())
        } else {
            Ok(std::mem::take(&mut self.output))
        };
        let stderr = if self.stderr.is_some() {
            join(self.stderr.take())
        } else {
            Ok(Vec::new())
        };
        let _ = self.group.kill();
        self.finished = true;
        let stdout = stdout?;
        stderr?;
        Ok(Output {
            success: status.success(),
            status: status.code(),
            stdout,
        })
    }

    fn abandon(&mut self) {
        self.stdout.take();
        self.stderr.take();
        self.finished = true;
    }
}

impl Drop for OwnedChild {
    fn drop(&mut self) {
        if !self.finished {
            let _ = self.group.kill();
            let start = self.clock.now();
            loop {
                if matches!(self.poll(), Ok(true))
                    || self.clock.now().saturating_sub(start) >= STOP_GRACE
                {
                    break;
                }
                self.clock.pause(POLL_INTERVAL);
            }
            self.abandon();
        }
    }
}

fn capture(reader: impl Read, group: &dyn ProcessGroup) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let result = reader
        .take((OUTPUT_LIMIT + 1) as u64)
        .read_to_end(&mut bytes);
    if result.is_err() || bytes.len() > OUTPUT_LIMIT {
        let _ = group.kill();
        result.base()?;
        return Err(Error::CommandOutputLimit);
    }
    Ok(bytes)
}

fn join(worker: Option<JoinHandle<Result<Vec<u8>>>>) -> Result<Vec<u8>> {
    match worker.map(JoinHandle::join) {
        Some(Ok(result)) => result,
        _ => Err(InternalError::Worker.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/process_stop_tests.rs"]
mod process_stop_tests;
