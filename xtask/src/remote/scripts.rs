//! Git and verification-script adapters over the process seam.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::remote::clients::outcome::success;
use crate::remote::contracts::{Aggregate, Fingerprint, Git, Output};
use crate::remote::error::{Error, Operation, Result};
use crate::remote::git_identity::{BaseLookup, CommitSha};
use crate::remote::parse::fingerprint_value;
use crate::remote::process::{Process, Request};

/// Script adapter consumed through distinct Git, fingerprint and aggregate traits.
pub(crate) struct SystemScripts {
    /// Process host.
    pub(crate) process: Arc<dyn Process + Send + Sync>,
    /// Checkout location.
    pub(crate) workspace: PathBuf,
}

impl SystemScripts {
    /// Capture one local command and require its real zero exit.
    fn capture(
        &self,
        program: &str,
        args: Vec<String>,
        operation: Operation,
        cwd: &Path,
    ) -> Result<Output> {
        let output = self.process.execute(&Request {
            program: program.into(),
            args,
            cwd: cwd.to_owned(),
            operation,
            input: None,
            log: None,
            cancellable: true,
            git_index: None,
            blacksmith: false,
        })?;
        if let Err(source) = success(&output, operation) {
            return Err(Error::Captured {
                source: Box::new(source),
                output,
            });
        }
        Ok(output)
    }
}

impl Git for SystemScripts {
    fn head(&self) -> Result<CommitSha> {
        CommitSha::read(
            &self
                .capture(
                    "git",
                    vec!["rev-parse".into(), "HEAD".into()],
                    Operation::Git,
                    &self.workspace,
                )?
                .stdout,
        )
    }
    fn base(&self, head: &CommitSha) -> Result<BaseLookup> {
        self.lookup_base(head)
    }
}

impl Fingerprint for SystemScripts {
    fn read(&self, cwd: &Path) -> Result<String> {
        let output = self.capture(
            "node",
            vec!["scripts/verification/source-tree.mjs".into()],
            Operation::Fingerprint,
            cwd,
        )?;
        match fingerprint_value(&output.stdout) {
            Ok(value) => Ok(value),
            Err(source) => Err(Error::Captured {
                source: Box::new(source),
                output,
            }),
        }
    }
}

impl Aggregate for SystemScripts {
    fn validate(&self, directory: &Path, head: &str) -> Result<()> {
        self.capture(
            "node",
            vec![
                "scripts/verification/aggregate.mjs".into(),
                "--reports".into(),
                directory.to_string_lossy().into_owned(),
                "--commit".into(),
                head.into(),
                "--runtimes".into(),
                "node-22.14.0".into(),
            ],
            Operation::Aggregate,
            &self.workspace,
        )?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/scripts_tests.rs"]
mod scripts_tests;
