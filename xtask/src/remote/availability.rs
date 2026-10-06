//! Ordered explicit-remote availability checks.

use crate::remote::error::{Error, Result};
use crate::remote::policy::{Check, ordered_checks};
use crate::remote::runner::DefaultRemoteRunner;

impl DefaultRemoteRunner {
    /// Validate remote mode without warming boxes or executing suites.
    pub(super) fn require_remote(&self) -> Result<()> {
        let dependencies = &self.dependencies;
        for check in ordered_checks() {
            match check {
                Check::GithubActions => {
                    if dependencies.environment.get("GITHUB_ACTIONS").as_deref() == Some("true") {
                        return Err(Error::GithubActions);
                    }
                }
                Check::Program(program) => {
                    if !dependencies.programs.find(program)? {
                        let hint = if program == "blacksmith" {
                            "install with curl -fsSL https://get.blacksmith.sh | sh"
                        } else {
                            "install rsync and ssh with the operating system package manager"
                        };
                        return Err(Error::MissingProgram { program, hint });
                    }
                }
                Check::Version => dependencies
                    .reporter
                    .executor(&dependencies.blacksmith.version()?),
                Check::Login => {
                    if let Some(key) = dependencies
                        .environment
                        .get("BLACKSMITH_ORG_TOKEN")
                        .filter(|key| !key.is_empty())
                    {
                        dependencies.blacksmith.login(&key)?;
                    }
                }
                Check::Access => dependencies.blacksmith.list()?,
                Check::Published => {
                    if !dependencies.git.published()? {
                        return Err(Error::UnpublishedHead);
                    }
                }
                Check::Interrupt => {
                    if dependencies.interrupt.requested() {
                        return Err(Error::Interrupted);
                    }
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/availability_tests.rs"]
mod availability_tests;
