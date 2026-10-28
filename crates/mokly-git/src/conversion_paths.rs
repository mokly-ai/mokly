//! Stream a raw blob only when Git's effective settings prove checkout conversion is identity.

use std::collections::BTreeSet;

use crate::command::DEFAULT_OUTPUT_LIMIT;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::repository::GitRepository;
use crate::tree::{Entry, text};

impl GitRepository {
    pub(crate) fn converted_paths(
        &self,
        commit: &ObjectId,
        entries: &[Entry],
    ) -> Result<BTreeSet<RepoPath>> {
        let requested: BTreeSet<_> = entries.iter().map(|entry| entry.path.clone()).collect();
        let autocrlf = match self.command(
            &["config", "--get", "core.autocrlf"],
            Vec::new(),
            DEFAULT_OUTPUT_LIMIT,
        ) {
            Ok(value) => text(&value)?.trim().to_ascii_lowercase(),
            Err(Error::CommandFailed {
                status: Some(1), ..
            }) => "false".into(),
            Err(error) => return Err(error),
        };
        if !matches!(autocrlf.as_str(), "false" | "no" | "off" | "0") {
            return Ok(requested);
        }
        let input = entries
            .iter()
            .map(|entry| format!("{}\0", entry.path))
            .collect::<String>()
            .into_bytes();
        let output = self.command(
            &[
                &format!("--attr-source={commit}"),
                "check-attr",
                "--all",
                "-z",
                "--stdin",
            ],
            input,
            DEFAULT_OUTPUT_LIMIT,
        )?;
        if output.is_empty() {
            return Ok(BTreeSet::new());
        }
        if output.last() != Some(&0) {
            return Err(Error::MalformedOutput);
        }
        let mut fields = output
            .strip_suffix(&[0])
            .unwrap_or(&output)
            .split(|byte| *byte == 0);
        let mut converted = BTreeSet::new();
        while let Some(path) = fields.next() {
            let path = RepoPath::parse(text(path)?)?;
            if fields.next().is_none() || fields.next().is_none() || !requested.contains(&path) {
                return Err(Error::MalformedOutput);
            }
            converted.insert(path);
        }
        Ok(converted)
    }
}
