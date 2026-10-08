//! GitHub cancellation and typed workflow state process requests.

use std::path::PathBuf;
use std::sync::Arc;

use crate::remote::clients::outcome::cleanup_success;
use crate::remote::contracts::{Github, GithubRunState};
use crate::remote::error::{Operation, Result};
use crate::remote::parse::github_run_state;
use crate::remote::process::{Process, Request};

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
            git_index: None,
            blacksmith: false,
        })?;
        cleanup_success(&output, Operation::Github)
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
            git_index: None,
            blacksmith: false,
        })?;
        cleanup_success(&output, Operation::Github)?;
        github_run_state(&output.stdout)
    }
}
