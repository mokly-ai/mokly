//! Promisor object discovery and one-shot base-object fetches.

use std::ffi::OsString;

use crate::command::{DEFAULT_OUTPUT_LIMIT, DEFAULT_STDERR_LIMIT, Request};
use crate::error::{Error, Result};
use crate::repository::GitRepository;
use crate::tree::{Entry, text};

impl GitRepository {
    pub(crate) fn ensure_objects(&self, entries: &[Entry]) -> Result<()> {
        if entries.is_empty() {
            return Ok(());
        }
        let mut input = Vec::new();
        for entry in entries {
            input.extend_from_slice(entry.object.as_str().as_bytes());
            input.push(b'\n');
        }
        let output = self.command(
            &[
                "cat-file",
                "--batch-check=%(objectname) %(objecttype) %(objectsize)",
            ],
            input,
            entries.len().saturating_mul(128).max(1024),
        )?;
        let records = output
            .split(|byte| *byte == b'\n')
            .filter(|line| !line.is_empty())
            .map(|line| {
                let mut fields = line.split(|byte| *byte == b' ');
                let object = fields.next().ok_or(Error::MalformedOutput)?;
                let kind = fields.next().ok_or(Error::MalformedOutput)?;
                if kind == b"missing" {
                    return Ok(Some(
                        std::str::from_utf8(object)
                            .map_err(|_| Error::PathEncoding)?
                            .to_owned(),
                    ));
                }
                if kind != b"blob" || fields.next().is_none() || fields.next().is_some() {
                    return Err(Error::MalformedOutput);
                }
                Ok(None)
            })
            .collect::<Result<Vec<_>>>()?;
        if records.len() != entries.len() {
            return Err(Error::MalformedOutput);
        }
        let missing = records.into_iter().flatten().collect::<Vec<_>>();
        if missing.is_empty() {
            return Ok(());
        }
        let object = missing.first().cloned().ok_or(Error::MalformedOutput)?;
        let remote = match self.promisor_remote()? {
            Some(remote) => remote,
            None => return Err(Error::MissingObject { object }),
        };
        let mut fetch_input = Vec::new();
        for object in &missing {
            fetch_input.extend_from_slice(object.as_bytes());
            fetch_input.push(b'\n');
        }
        let result = self.runner.run(&Request {
            directory: self.directory.clone(),
            args: [
                "--no-optional-locks",
                "fetch",
                "--no-tags",
                "--no-write-fetch-head",
                remote.as_str(),
                "--stdin",
            ]
            .into_iter()
            .map(OsString::from)
            .collect(),
            stdin: fetch_input,
            output_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_STDERR_LIMIT,
        });
        match result {
            Ok(_) => Ok(()),
            Err(crate::error::Error::CommandFailed { stderr, .. }) => Err(Error::FetchFailed {
                remote,
                object,
                stderr,
            }),
            Err(error) => Err(error),
        }
    }

    fn promisor_remote(&self) -> Result<Option<String>> {
        let output = match self.command(
            &["config", "--get-regexp", "remote\\..*\\.promisor"],
            vec![],
            4096,
        ) {
            Ok(output) => output,
            Err(crate::error::Error::CommandFailed {
                status: Some(1), ..
            }) => return Ok(None),
            Err(error) => return Err(error),
        };
        for line in text(&output)?.lines() {
            let mut fields = line.split_ascii_whitespace();
            let Some(key) = fields.next() else {
                continue;
            };
            if fields.next() != Some("true") {
                continue;
            }
            let Some(remote) = key
                .strip_prefix("remote.")
                .and_then(|key| key.strip_suffix(".promisor"))
            else {
                continue;
            };
            if !remote.is_empty() {
                return Ok(Some(remote.to_owned()));
            }
        }
        Ok(None)
    }
}
