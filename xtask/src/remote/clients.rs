//! Blacksmith and GitHub command adapters with explicit secret boundaries.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::remote::contracts::{Blacksmith, Github, Output};
use crate::remote::error::{Error, Operation, Result};
use crate::remote::process::{Process, Request};

/// Blacksmith client backed by an injected process host.
pub(crate) struct SystemBlacksmith {
    /// Process boundary.
    pub(crate) process: Arc<dyn Process + Send + Sync>,
    /// Checkout root.
    pub(crate) workspace: PathBuf,
}

impl SystemBlacksmith {
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
