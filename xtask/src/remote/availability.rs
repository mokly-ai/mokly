//! Trait-backed availability selection with ordered automatic fallback.

use crate::executor::{Decision, Executor, LocalReason};
use crate::remote::contracts::Dependencies;

use crate::remote::error::{Error, Result};
use crate::remote::policy::{Check, ordered_checks};
use crate::remote::reporting::warning;
/// Availability selection without box warmup or suite execution.
#[cfg_attr(test, unimock::unimock(api = [SelectorSelectMock]))]
pub(crate) trait Selector: Send + Sync {
    /// Apply the requested mode's ordered decision table.
    fn select(&self, mode: Executor) -> Result<Decision>;
}

/// Availability policy with injected environment and command boundaries.
pub(crate) struct DefaultSelector {
    /// Shared runtime boundaries.
    pub(crate) dependencies: Dependencies,
}

impl Selector for DefaultSelector {
    fn select(&self, mode: Executor) -> Result<Decision> {
        if mode == Executor::Local {
            return Ok(Decision::Local(LocalReason::Requested));
        }
        let mut key = None;
        for check in ordered_checks(mode) {
            match self.check(check, mode, &mut key) {
                Ok(Some(reason)) => return Ok(Decision::Local(reason)),
                Ok(None) => {}
                Err(error @ Error::Interrupted { .. }) => return Err(error),
                Err(error) if mode == Executor::Remote => return Err(error),
                Err(error) => {
                    self.dependencies.reporter.executor(&warning("", &error));
                    return Ok(Decision::Local(check.local_reason()));
                }
            }
        }
        Ok(Decision::Remote)
    }
}

impl DefaultSelector {
    /// Run one named availability condition while keeping key bytes private.
    fn check(
        &self,
        check: Check,
        mode: Executor,
        key: &mut Option<String>,
    ) -> Result<Option<LocalReason>> {
        let dependencies = &self.dependencies;
        match check {
            Check::GithubActions => {
                if dependencies.environment.get("GITHUB_ACTIONS").as_deref() == Some("true") {
                    if mode == Executor::Auto {
                        return Ok(Some(LocalReason::GithubActions));
                    }
                    return Err(Error::GithubActions);
                }
            }
            Check::Key => {
                *key = dependencies
                    .environment
                    .get("BLACKSMITH_ORG_TOKEN")
                    .filter(|key| !key.is_empty());
                if key.is_none() {
                    dependencies.reporter.executor("information: BLACKSMITH_ORG_TOKEN is empty or unset; using local verification");
                    return Ok(Some(LocalReason::NoKey));
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
                if mode == Executor::Remote {
                    *key = dependencies
                        .environment
                        .get("BLACKSMITH_ORG_TOKEN")
                        .filter(|key| !key.is_empty());
                }
                if let Some(key) = key {
                    dependencies.blacksmith.login(key)?;
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
                    return Err(Error::Interrupted { cleanup: 0 });
                }
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
#[path = "_tests_/availability_tests.rs"]
mod availability_tests;
