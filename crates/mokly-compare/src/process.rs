//! Host package-manager processes with owned trees and bounded output pipes.

use std::io::Read;
use std::process::{self, Stdio};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
#[cfg(windows)]
use std::{env, fs, path::PathBuf};

use mokly_platform::processes::{ProcessGroup, ProcessGroups};

use crate::commands::{Child, Command, Output, Spawner};
use crate::error::{Error, InternalError, IoResult, Result};

const OUTPUT_LIMIT: usize = 1024 * 1024;

/// Shell-free process adapter, composed with platform process-tree ownership.
pub struct SystemSpawner {
    /// OS process group or job-object implementation.
    pub groups: Arc<dyn ProcessGroups>,
}

struct OwnedChild {
    process: process::Child,
    group: Arc<dyn ProcessGroup>,
    stdout: Option<JoinHandle<Result<Vec<u8>>>>,
    stderr: Option<JoinHandle<Result<Vec<u8>>>>,
}

impl SystemSpawner {
    fn command(&self, request: &Command) -> Result<process::Command> {
        #[cfg(windows)]
        if request.program == "npm" {
            return self.npm();
        }
        Ok(process::Command::new(&request.program))
    }

    #[cfg(windows)]
    fn npm(&self) -> Result<process::Command> {
        let paths = env::var_os("PATH").unwrap_or_default();
        let directories = env::split_paths(&paths)
            .filter(|path| path.is_absolute())
            .collect::<Vec<_>>();
        let extensions = env::var_os("PATHEXT").unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".into());
        for directory in &directories {
            for extension in extensions
                .to_string_lossy()
                .split(';')
                .filter(|extension| !extension.is_empty())
            {
                let candidate = directory.join(format!("npm{extension}"));
                if !fs::metadata(&candidate).is_ok_and(|metadata| metadata.is_file()) {
                    continue;
                }
                if extension.eq_ignore_ascii_case(".exe") || extension.eq_ignore_ascii_case(".com")
                {
                    return Ok(process::Command::new(candidate));
                }
                if !extension.eq_ignore_ascii_case(".cmd") {
                    return Err(Error::UnsupportedManager);
                }
                let cli = directory.join("node_modules/npm/bin/npm-cli.js");
                if !cli.is_file() {
                    return Err(Error::UnsupportedManager);
                }
                let node: Option<PathBuf> = std::iter::once(directory.join("node.exe"))
                    .chain(directories.iter().map(|path| path.join("node.exe")))
                    .find(|path| path.is_file());
                let Some(node) = node else {
                    return Err(Error::UnsupportedManager);
                };
                let mut command = process::Command::new(node);
                command.arg(cli);
                return Ok(command);
            }
        }
        Err(Error::UnsupportedManager)
    }
}

impl Spawner for SystemSpawner {
    fn spawn(&self, request: &Command) -> Result<Box<dyn Child>> {
        let mut command = self.command(request)?;
        command
            .args(&request.args)
            .current_dir(&request.directory)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("npm_config_ignore_scripts", "true")
            .env("npm_config_audit", "false")
            .env("npm_config_fund", "false")
            .env("npm_config_update_notifier", "false");
        if let Err(source) = self.groups.configure(&mut command) {
            return Err(InternalError::Platform { source }.into());
        }
        let mut process = command.spawn().base()?;
        let group: Arc<dyn ProcessGroup> = match self.groups.attach(&process) {
            Ok(group) => Arc::from(group),
            Err(source) => {
                let _ = process.kill();
                let _ = process.wait();
                return Err(InternalError::Platform { source }.into());
            }
        };
        let (Some(stdout), Some(stderr)) = (process.stdout.take(), process.stderr.take()) else {
            let _ = group.kill();
            let _ = process.wait();
            return Err(InternalError::Worker.into());
        };
        let output_group = Arc::clone(&group);
        let error_group = Arc::clone(&group);
        Ok(Box::new(OwnedChild {
            process,
            group,
            stdout: Some(thread::spawn(move || {
                capture(stdout, output_group.as_ref())
            })),
            stderr: Some(thread::spawn(move || capture(stderr, error_group.as_ref()))),
        }))
    }
}

impl Child for OwnedChild {
    fn poll(&mut self) -> Result<bool> {
        Ok(self.process.try_wait().base()?.is_some()
            && self
                .stdout
                .as_ref()
                .is_none_or(|worker| worker.is_finished())
            && self
                .stderr
                .as_ref()
                .is_none_or(|worker| worker.is_finished()))
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
        let status = self.process.wait().base()?;
        let stdout = join(self.stdout.take());
        let stderr = join(self.stderr.take());
        let _ = self.group.kill();
        let stdout = stdout?;
        stderr?;
        Ok(Output {
            success: status.success(),
            status: status.code(),
            stdout,
        })
    }
}

impl Drop for OwnedChild {
    fn drop(&mut self) {
        if self.stdout.is_some() || self.stderr.is_some() {
            let _ = self.group.kill();
            let _ = self.process.wait();
            let _ = join(self.stdout.take());
            let _ = join(self.stderr.take());
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
