//! Blacksmith CLI requests and the shared SSH close trait entrypoint.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::remote::clients::outcome::{cleanup_success, success};
use crate::remote::contracts::{Blacksmith, Disconnection, Output};
use crate::remote::error::{Operation, Result};
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
    /// Build one private-input-safe CLI request.
    fn call(
        &self,
        args: Vec<String>,
        input: Option<String>,
        log: Option<PathBuf>,
        cancellable: bool,
    ) -> Result<Output> {
        self.call_at(args, input, log, cancellable, &self.workspace)
    }

    /// Override only the synchronization source for probes and suite runs.
    fn call_at(
        &self,
        args: Vec<String>,
        input: Option<String>,
        log: Option<PathBuf>,
        cancellable: bool,
        cwd: &Path,
    ) -> Result<Output> {
        self.process.execute(&Request {
            program: "blacksmith".into(),
            args,
            cwd: cwd.to_owned(),
            operation: Operation::Blacksmith,
            input,
            log,
            cancellable,
            git_index: None,
            blacksmith: true,
        })
    }
}

impl Blacksmith for SystemBlacksmith {
    fn disconnect(&self, id: &str) -> Result<Disconnection> {
        self.disconnect_shared(id)
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
    fn run(&self, cwd: &Path, id: &str, command: &str, log: Option<&Path>) -> Result<Output> {
        self.call_at(
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
            cwd,
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
        cleanup_success(&output, Operation::Blacksmith)?;
        Ok(output.combined())
    }
    fn stop(&self, id: &str) -> Result<()> {
        let output = self.call(
            vec!["testbox".into(), "stop".into(), "--id".into(), id.into()],
            None,
            None,
            false,
        )?;
        cleanup_success(&output, Operation::Blacksmith)
    }
}

#[cfg(test)]
#[path = "_tests_/clients_tests.rs"]
mod clients_tests;
