//! Every documented GitHub subscription needs its own recorded delivery file.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use crate::error::{Error, Result, reject};
use crate::policy::diagnostic::Violation;

pub(super) fn validate(protocol: &str, files: &[PathBuf]) -> Result<()> {
    let events = subscriptions(protocol)?;
    let mut covered = BTreeSet::new();
    for path in files {
        if path.parent() != Some(Path::new("crates/mkc-api/tests/fixtures/github"))
            || path.extension().is_none_or(|extension| extension != "json")
        {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|name| name.to_str()) else {
            continue;
        };
        let event = events
            .iter()
            .filter(|event| {
                let prefix = event.replace('_', "-");
                stem == prefix
                    || stem
                        .strip_prefix(&prefix)
                        .is_some_and(|suffix| suffix.starts_with('-') && suffix.len() > 1)
            })
            .max_by_key(|event| event.len());
        if let Some(event) = event {
            covered.insert(event.clone());
        }
    }
    reject(
        events
            .difference(&covered)
            .cloned()
            .map(Violation::GitHubDeliveryFixture)
            .collect(),
    )
}

/// Require one period-terminated, comma-separated list of backticked event names.
fn subscriptions(protocol: &str) -> Result<BTreeSet<String>> {
    let invalid = || Error::Violations(vec![Violation::GitHubSubscriptions]);
    let mut lists = protocol.split("Subscribe to ");
    lists.next();
    let body = lists.next().ok_or_else(invalid)?;
    if lists.next().is_some() {
        return Err(invalid());
    }
    let (sentence, _) = body.split_once('.').ok_or_else(invalid)?;
    let mut events = BTreeSet::new();
    for token in sentence.split(',') {
        let event = token
            .trim()
            .strip_prefix('`')
            .and_then(|name| name.strip_suffix('`'))
            .ok_or_else(invalid)?;
        if event.is_empty()
            || !event
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
            || !events.insert(event.to_owned())
        {
            return Err(invalid());
        }
    }
    Ok(events)
}
