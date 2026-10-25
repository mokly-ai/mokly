//! Serialize missing-object discovery and fetch before parallel base reads.

use std::collections::BTreeSet;
use std::ffi::OsString;
use std::time::Duration;

use crate::command::{Cancellation, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{Error, Result};
use crate::identity::ObjectId;
use crate::repository::GitRepository;
use crate::tree::{Entry, Mode, text};

struct Active;
impl Cancellation for Active {
    fn is_cancelled(&self) -> bool {
        false
    }
}

impl GitRepository {
    pub(crate) fn ensure_objects(&self, entries: &[Entry]) -> Result<bool> {
        let ids: BTreeSet<_> = entries
            .iter()
            .filter(|entry| entry.mode.regular() || entry.mode == Mode::Symlink)
            .map(|entry| entry.object.clone())
            .collect();
        if ids.is_empty() {
            return Ok(false);
        }
        let _fetch = self
            .fetch_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let input = ids
            .iter()
            .map(|id| format!("{id}\n"))
            .collect::<String>()
            .into_bytes();
        let output = self.command(
            &[
                "rev-list",
                "--objects",
                "--no-object-names",
                "--missing=print",
                "--stdin",
            ],
            input,
            DEFAULT_OUTPUT_LIMIT,
        )?;
        let mut missing = BTreeSet::new();
        for line in text(&output)?.lines() {
            if let Some(id) = line.strip_prefix('?') {
                missing.insert(ObjectId::parse(id)?);
            } else {
                ObjectId::parse(line)?;
            }
        }
        let Some(object) = missing.first().map(ToString::to_string) else {
            return Ok(false);
        };
        let remotes = self.promisor_remotes()?;
        if remotes.is_empty() {
            return Err(Error::MissingObject { object });
        }
        let mut last = None;
        for remote in remotes {
            let request = Request {
                directory: self.directory.clone(),
                args: [
                    "--no-optional-locks",
                    "-c",
                    "fetch.negotiationAlgorithm=noop",
                    "fetch",
                    "--no-tags",
                    "--no-write-fetch-head",
                    "--no-recurse-submodules",
                    "--no-auto-maintenance",
                    "--stdin",
                    "--",
                    &remote,
                ]
                .into_iter()
                .map(OsString::from)
                .collect(),
                stdin: missing
                    .iter()
                    .map(|id| format!("{id}\n"))
                    .collect::<String>()
                    .into_bytes(),
                output_limit: DEFAULT_OUTPUT_LIMIT,
                stderr_limit: DEFAULT_STDERR_LIMIT,
            };
            let result = self.runner.run_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[],
                Duration::from_secs(120),
            );
            match result {
                Ok(_) => return Ok(true),
                Err(Error::Cancelled) => return Err(Error::Cancelled),
                Err(source) => {
                    last = Some(Error::FetchFailed {
                        remote,
                        object: object.clone(),
                        source: Box::new(source),
                    })
                }
            }
        }
        Err(last.unwrap_or(Error::MissingObject { object }))
    }

    fn promisor_remotes(&self) -> Result<Vec<String>> {
        let output = match self.command(
            &["config", "--null", "--get-regexp", "remote\\..*\\.promisor"],
            vec![],
            DEFAULT_OUTPUT_LIMIT,
        ) {
            Ok(output) => output,
            Err(Error::CommandFailed {
                status: Some(1), ..
            }) => return Ok(vec![]),
            Err(error) => return Err(error),
        };
        let mut remotes = Vec::new();
        for record in text(&output)?.split_terminator('\0') {
            let Some((key, value)) = record.split_once('\n') else {
                return Err(Error::MalformedOutput);
            };
            if !matches!(
                value.to_ascii_lowercase().as_str(),
                "true" | "yes" | "on" | "1" | ""
            ) {
                continue;
            }
            let Some(remote) = key
                .strip_prefix("remote.")
                .and_then(|key| key.strip_suffix(".promisor"))
            else {
                return Err(Error::MalformedOutput);
            };
            remotes.push(remote.to_owned());
        }
        Ok(remotes)
    }
}
