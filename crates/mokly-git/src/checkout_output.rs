//! Decode owned checkout filenames and classify recoverable conversion failures.

use std::path::{Path, PathBuf};

use crate::error::{Error, Result};
use crate::identity::RepoPath;
use crate::tree::{Entry, text};

pub(crate) fn parse_output(
    output: &[u8],
    worktree: &Path,
    entries: &[Entry],
) -> Result<std::collections::BTreeMap<RepoPath, PathBuf>> {
    let expected: std::collections::BTreeSet<_> =
        entries.iter().map(|entry| entry.path.clone()).collect();
    let mut files = std::collections::BTreeMap::new();
    for record in output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
            return Err(Error::MalformedOutput);
        };
        let temporary = text(&record[..tab])?;
        let path = RepoPath::parse(text(&record[tab + 1..])?)?;
        if !expected.contains(&path) || files.contains_key(&path) {
            return Err(Error::MalformedOutput);
        }
        let temporary = Path::new(temporary);
        if temporary.is_absolute()
            || temporary
                .components()
                .any(|component| matches!(component, std::path::Component::ParentDir))
        {
            return Err(Error::MalformedOutput);
        }
        files.insert(path, worktree.join(temporary));
    }
    if files.len() != expected.len() {
        return Err(Error::MalformedOutput);
    }
    Ok(files)
}

pub(crate) fn conversion<T>(result: Result<T>, entries: &[Entry]) -> Result<T> {
    match result {
        Err(
            source @ (Error::CheckoutTimeout
            | Error::CheckoutFailed { .. }
            | Error::CommandFailed { .. }
            | Error::ByteLimit { .. }
            | Error::OutputLimit { .. }),
        ) => Err(Error::Conversion {
            path: entries
                .first()
                .map_or(".", |entry| entry.path.as_str())
                .into(),
            source: Box::new(source),
        }),
        other => other,
    }
}
