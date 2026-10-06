//! Git and verification-script adapters over the process seam.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::remote::clients::success;
use crate::remote::contracts::{Aggregate, Fingerprint, Git};
use crate::remote::error::{Operation, Result};
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
    fn capture(&self, program: &str, args: Vec<String>, operation: Operation) -> Result<String> {
        let output = self.process.execute(&Request {
            program: program.into(),
            args,
            cwd: self.workspace.clone(),
            operation,
            input: None,
            log: None,
            cancellable: true,
            blacksmith: false,
        })?;
        success(&output, operation)?;
        Ok(output.stdout)
    }
}

impl Git for SystemScripts {
    fn head(&self) -> Result<String> {
        Ok(self
            .capture(
                "git",
                vec!["rev-parse".into(), "HEAD".into()],
                Operation::Git,
            )?
            .trim()
            .to_owned())
    }
    fn published(&self) -> Result<bool> {
        Ok(!self
            .capture(
                "git",
                vec![
                    "for-each-ref".into(),
                    "--contains".into(),
                    "HEAD".into(),
                    "--format=%(refname)".into(),
                    "refs/remotes/origin/".into(),
                ],
                Operation::Git,
            )?
            .trim()
            .is_empty())
    }
}

impl Fingerprint for SystemScripts {
    fn read(&self) -> Result<String> {
        fingerprint_value(&self.capture(
            "node",
            vec!["scripts/verification/source-tree.mjs".into()],
            Operation::Fingerprint,
        )?)
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
        )?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/scripts_tests.rs"]
mod scripts_tests;
