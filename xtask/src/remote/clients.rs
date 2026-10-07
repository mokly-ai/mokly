//! Blacksmith and GitHub command adapters with explicit secret boundaries.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use sha2::{Digest, Sha256};

use crate::remote::contracts::{Blacksmith, Disconnection, Github, GithubRunState, Output};
use crate::remote::error::{Error, Operation, Result};
use crate::remote::parse::github_run_state;
use crate::remote::process::{Process, Request};

/// Blacksmith client backed by an injected process host.
pub(crate) struct SystemBlacksmith {
    /// Process boundary.
    pub(crate) process: Arc<dyn Process + Send + Sync>,
    /// Checkout root.
    pub(crate) workspace: PathBuf,
    /// HOME supplied by the environment boundary at the composition root.
    pub(crate) home: Option<PathBuf>,
}

impl SystemBlacksmith {
    /// Derive the CLI socket from HOME and the first eight SHA-256 bytes.
    fn control_socket(&self, id: &str) -> Result<PathBuf> {
        let home = self
            .home
            .as_deref()
            .filter(|home| !home.as_os_str().is_empty())
            .ok_or(Error::MissingHome)?;
        let name: String = Sha256::digest(id.as_bytes())
            .iter()
            .take(8)
            .map(|byte| format!("{byte:02x}"))
            .collect();
        Ok(self
            .workspace
            .join(home)
            .join(".blacksmith/c")
            .join(format!("{name}.sock")))
    }

    /// Build one private-input-safe CLI request.
    fn call(
        &self,
        args: Vec<String>,
        input: Option<String>,
        log: Option<PathBuf>,
        cancellable: bool,
    ) -> Result<Output> {
        self.process.execute(&Request {
            program: "blacksmith".into(),
            args,
            cwd: self.workspace.clone(),
            operation: Operation::Blacksmith,
            input,
            log,
            cancellable,
            blacksmith: true,
        })
    }
}

impl Blacksmith for SystemBlacksmith {
    fn disconnect(&self, id: &str) -> Result<Disconnection> {
        let socket = self.control_socket(id)?;
        match socket.try_exists() {
            Ok(false) => return Ok(Disconnection::Absent),
            Ok(true) => {}
            Err(source) => {
                return Err(Error::Io {
                    operation: Operation::Ssh,
                    source,
                });
            }
        }
        let result = self
            .process
            .execute(&Request {
                program: "ssh".into(),
                args: vec![
                    "-F".into(),
                    "/dev/null".into(),
                    "-S".into(),
                    socket.to_string_lossy().into_owned(),
                    "-O".into(),
                    "exit".into(),
                    "localhost".into(),
                ],
                cwd: self.workspace.clone(),
                operation: Operation::Ssh,
                input: None,
                log: None,
                cancellable: false,
                blacksmith: false,
            })
            .and_then(|output| success(&output, Operation::Ssh));
        match result {
            Ok(()) => Ok(Disconnection::Closed),
            Err(error) => match socket.try_exists() {
                Ok(false) => Ok(Disconnection::Closed),
                Ok(true) => Err(error),
                Err(source) => Err(Error::Io {
                    operation: Operation::Ssh,
                    source,
                }),
            },
        }
    }
    fn version(&self) -> Result<String> {
        let output = self.call(vec!["--version".into()], None, None, true)?;
        success(&output, Operation::Blacksmith)?;
        Ok(output.stdout.trim().to_owned())
    }
    fn login(&self, key: &str) -> Result<()> {
        let output = self.call(
            vec![
                "auth".into(),
                "login".into(),
                "--api-token".into(),
                "-".into(),
            ],
            Some(key.to_owned()),
            None,
            true,
        )?;
        success(&output, Operation::Blacksmith)
    }
    fn list(&self) -> Result<()> {
        success(
            &self.call(vec!["testbox".into(), "list".into()], None, None, true)?,
            Operation::Blacksmith,
        )
    }
    fn warmup(&self, reference: &str) -> Result<Output> {
        self.call(
            vec![
                "testbox".into(),
                "warmup".into(),
                "blacksmith-testbox.yml".into(),
                "--ref".into(),
                reference.into(),
                "--idle-timeout".into(),
                "30".into(),
            ],
            None,
            None,
            false,
        )
    }
    fn run(&self, id: &str, command: &str, log: Option<&Path>) -> Result<Output> {
        self.call(
            vec![
                "testbox".into(),
                "run".into(),
                "--id".into(),
                id.into(),
                "--wait-timeout".into(),
                "10m".into(),
                command.into(),
            ],
            None,
            log.map(Path::to_path_buf),
            true,
        )
    }
    fn download(&self, id: &str, source: &str, target: &Path) -> Result<()> {
        let output = self.call(
            vec![
                "testbox".into(),
                "download".into(),
                "--id".into(),
                id.into(),
                source.into(),
                target.to_string_lossy().into_owned(),
            ],
            None,
            None,
            true,
        )?;
        success(&output, Operation::Blacksmith)
    }
    fn status(&self, id: &str) -> Result<String> {
        let output = self.call(
            vec!["testbox".into(), "status".into(), "--id".into(), id.into()],
            None,
            None,
            false,
        )?;
        success(&output, Operation::Blacksmith)?;
        Ok(output.combined())
    }
    fn stop(&self, id: &str) -> Result<()> {
        let output = self.call(
            vec!["testbox".into(), "stop".into(), "--id".into(), id.into()],
            None,
            None,
            false,
        )?;
        success(&output, Operation::Blacksmith)
    }
}

/// Optional GitHub cancellation backed by the same process boundary.
pub(crate) struct SystemGithub {
    /// Process boundary.
    pub(crate) process: Arc<dyn Process + Send + Sync>,
    /// Checkout root.
    pub(crate) workspace: PathBuf,
}

impl Github for SystemGithub {
    fn cancel(&self, id: u64) -> Result<()> {
        let output = self.process.execute(&Request {
            program: "gh".into(),
            args: vec!["run".into(), "cancel".into(), id.to_string()],
            cwd: self.workspace.clone(),
            operation: Operation::Github,
            input: None,
            log: None,
            cancellable: false,
            blacksmith: false,
        })?;
        success(&output, Operation::Github)
    }
    fn state(&self, id: u64) -> Result<GithubRunState> {
        let output = self.process.execute(&Request {
            program: "gh".into(),
            args: vec![
                "run".into(),
                "view".into(),
                id.to_string(),
                "--json".into(),
                "status".into(),
                "--jq".into(),
                ".status".into(),
            ],
            cwd: self.workspace.clone(),
            operation: Operation::Github,
            input: None,
            log: None,
            cancellable: false,
            blacksmith: false,
        })?;
        success(&output, Operation::Github)?;
        github_run_state(&output.stdout)
    }
}

/// Convert process termination into a typed boundary failure.
pub(crate) fn success(output: &Output, operation: Operation) -> Result<()> {
    if output.success() {
        Ok(())
    } else {
        Err(Error::Command {
            operation,
            code: output.code,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/clients_tests.rs"]
mod clients_tests;

#[cfg(test)]
#[path = "_tests_/disconnect_adapter_tests.rs"]
mod disconnect_adapter_tests;

#[cfg(all(test, unix))]
#[path = "_tests_/disconnect_process_adapter_tests.rs"]
mod disconnect_process_adapter_tests;
