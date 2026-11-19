//! Serialize missing-object discovery and fetch before parallel base reads.

use std::collections::BTreeSet;
use std::ffi::OsString;
use std::time::Duration;

use crate::command::{
    Cancellation, DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, ProcessMode, Request,
};
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
    /// Fetches every missing blob of `entries` from a promisor remote in one
    /// `fetch --stdin` request; checkout reads pass their attribute files too.
    /// The fetch lock serializes this step, so parallel conversion reads never
    /// start competing fetches. Returns whether a fetch ran.
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
        let output = self.command_with_mode(
            ProcessMode::PlainGroup,
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
        if self.promisor_remotes.is_empty() {
            return Err(Error::MissingObject { object });
        }
        let mut last = None;
        for remote in &self.promisor_remotes {
            let request = Request {
                process_mode: Default::default(),
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
                    remote,
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
                        remote: remote.clone(),
                        object: object.clone(),
                        source: Box::new(source),
                    })
                }
            }
        }
        Err(last.unwrap_or(Error::MissingObject { object }))
    }

    /// Read both promisor flags and the original partial-clone remote setting.
    pub(crate) fn read_promisor_remotes(&self) -> Result<Vec<String>> {
        let output = match self.command_with_mode(
            ProcessMode::PlainGroup,
            &[
                "config",
                "--null",
                "--get-regexp",
                r"^(remote\..*\.promisor|extensions\.partialclone)$",
            ],
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
        let mut partial_clone = None;
        for record in text(&output)?.split_terminator('\0') {
            let (key, value) = match record.split_once('\n') {
                Some(setting) => setting,
                None if record.starts_with("remote.") && record.ends_with(".promisor") => {
                    (record, "true")
                }
                None => return Err(Error::MalformedOutput),
            };
            if key == "extensions.partialclone" {
                partial_clone = Some(value.to_owned());
                continue;
            }
            if !promisor_enabled(value) {
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
        if let Some(remote) = partial_clone
            && !remotes.contains(&remote)
        {
            remotes.push(remote);
        }
        Ok(remotes)
    }
}

/// Keep full ownership unless a promisor setting is a known false value.
fn promisor_enabled(value: &str) -> bool {
    let value = value.to_ascii_lowercase();
    if matches!(value.as_str(), "false" | "no" | "off" | "") {
        return false;
    }
    let number = value.strip_prefix(['+', '-']).unwrap_or(&value);
    let number = number.strip_suffix(['k', 'm', 'g']).unwrap_or(number);
    let digits = number.strip_prefix("0x").unwrap_or(number);
    digits.is_empty() || !digits.bytes().all(|digit| digit == b'0')
}
