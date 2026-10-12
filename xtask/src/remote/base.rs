//! Origin ancestor lookup over the injected process boundary.

use std::collections::BTreeSet;

use crate::remote::clients::outcome::success;
use crate::remote::contracts::Output;
use crate::remote::error::{Error, Operation, Result};
use crate::remote::git_identity::{BaseCommit, BaseLookup, CommitSha};
use crate::remote::process::Request;
use crate::remote::scripts::SystemScripts;

impl SystemScripts {
    /// Select a typed pushed ancestor without fetching origin.
    pub(super) fn lookup_base(&self, head: &CommitSha) -> Result<BaseLookup> {
        let listing = self.base_git(
            vec![
                "for-each-ref".into(),
                "--format=%(refname) %(symref)".into(),
                "refs/remotes/origin/".into(),
            ],
            false,
        )?;
        let records: Vec<Vec<_>> = listing
            .stdout
            .lines()
            .map(|line| line.split_ascii_whitespace().collect())
            .collect();
        let mut candidates = BTreeSet::new();
        for record in &records {
            if let [reference] = record.as_slice()
                && let Some(sha) = self.common_ancestor(head, reference)?
            {
                candidates.insert(sha);
            }
        }
        if candidates.is_empty() {
            return Ok(BaseLookup::NoBase);
        }
        let mut args = vec!["merge-base".into(), "--independent".into()];
        args.extend(candidates.iter().map(|sha| sha.as_str().to_owned()));
        let independent = self.base_git(args, false)?;
        let candidates: BTreeSet<_> = independent
            .stdout
            .lines()
            .map(CommitSha::read)
            .collect::<Result<_>>()?;
        let main = if records
            .iter()
            .any(|record| record.first() == Some(&"refs/remotes/origin/main"))
        {
            self.common_ancestor(head, "refs/remotes/origin/main")?
        } else {
            None
        };
        let mut eligible = Vec::new();
        for candidate in candidates {
            if let Some(main) = &main {
                let output = self.base_git(
                    vec![
                        "merge-base".into(),
                        "--is-ancestor".into(),
                        main.as_str().into(),
                        candidate.as_str().into(),
                    ],
                    true,
                )?;
                if output.code == Some(1) {
                    continue;
                }
            }
            let output = self.base_git(
                vec![
                    "rev-list".into(),
                    "--count".into(),
                    format!("{candidate}..{head}"),
                ],
                false,
            )?;
            let ahead = match output.stdout.trim().parse() {
                Ok(ahead) => ahead,
                Err(source) => return Err(Error::AheadCount { source }),
            };
            eligible.push(BaseCommit {
                sha: candidate,
                ahead,
            });
        }
        match eligible.into_iter().min_by(|first, second| {
            first
                .ahead
                .cmp(&second.ahead)
                .then_with(|| first.sha.cmp(&second.sha))
        }) {
            Some(base) => Ok(BaseLookup::Found(base)),
            None => Ok(BaseLookup::NoBase),
        }
    }

    /// Exit 1 is the typed absence of common history, rather than a command error.
    fn common_ancestor(&self, head: &CommitSha, reference: &str) -> Result<Option<CommitSha>> {
        let output = self.base_git(
            vec!["merge-base".into(), head.as_str().into(), reference.into()],
            true,
        )?;
        if output.code == Some(1) {
            return Ok(None);
        }
        Ok(Some(CommitSha::read(&output.stdout)?))
    }

    /// Run only shell-free Git lookup commands and retain unexpected failure output.
    fn base_git(&self, args: Vec<String>, allow_absent: bool) -> Result<Output> {
        let output = self.process.execute(&Request {
            program: "git".into(),
            args,
            cwd: self.workspace.clone(),
            operation: Operation::Git,
            input: None,
            log: None,
            cancellable: true,
            blacksmith: false,
            git_index: None,
        })?;
        if !(allow_absent && output.code == Some(1))
            && let Err(source) = success(&output, Operation::Git)
        {
            return Err(Error::Captured {
                source: Box::new(source),
                output,
            });
        }
        Ok(output)
    }
}

#[cfg(test)]
#[path = "_tests_/base_adapter_tests.rs"]
mod base_adapter_tests;

#[cfg(test)]
#[path = "_tests_/base_tests.rs"]
mod base_tests;
