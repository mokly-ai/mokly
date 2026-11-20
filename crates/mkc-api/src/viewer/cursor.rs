//! Opaque versioned cursors binding complete ordering keys to their read scope.
//!
//! A cursor is JSON encoded as lowercase hexadecimal bytes. Decoding rejects a
//! malformed value, another version, another operation or project, and a
//! history filter that differs from the request's.

use mkc_domain::entry_path::EntryPath;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::build_history::HistoryKey;
use mkc_store_interface::viewer::{BranchKey, HistoryFilter, PublicationKey, PullRequestKey};
use serde::{Deserialize, Serialize};

use crate::payload::Page;
use crate::platform::error::{Error, ErrorResultExt, Result};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) enum Scope {
    Branches(ProjectId),
    PullRequests(ProjectId),
    History(ProjectId, HistoryFilter),
    BuildHistory(ProjectId, HistoryFilter),
    Screens(ProjectId, PublicationId),
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) enum Key {
    Branch(BranchKey),
    PullRequest(PullRequestKey),
    Publication(PublicationKey),
    History(HistoryKey),
    Screen(EntryPath),
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Cursor {
    version: u8,
    scope: Scope,
    key: Key,
}

pub(crate) fn decode(value: &str, scope: &Scope) -> Result<Key> {
    if value.is_empty()
        || value.len() > 16_384
        || !value.len().is_multiple_of(2)
        || !value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err(Error::InvalidInput);
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    for pair in value.as_bytes().as_chunks::<2>().0 {
        let digit = |c: u8| if c <= b'9' { c - b'0' } else { c - b'a' + 10 };
        bytes.push(digit(pair[0]) * 16 + digit(pair[1]));
    }
    let cursor: Cursor = match serde_json::from_slice(&bytes) {
        Ok(cursor) => cursor,
        Err(_) => return Err(Error::InvalidInput),
    };
    if cursor.version != 1
        || &cursor.scope != scope
        || !matches!(
            (scope, &cursor.key),
            (Scope::Branches(_), Key::Branch(_))
                | (Scope::PullRequests(_), Key::PullRequest(_))
                | (Scope::History(..), Key::Publication(_))
                | (Scope::BuildHistory(..), Key::History(_))
                | (Scope::Screens(..), Key::Screen(_))
        )
    {
        return Err(Error::InvalidInput);
    }
    Ok(cursor.key)
}

pub(crate) fn encode(scope: &Scope, key: Key) -> Result<String> {
    let bytes = serde_json::to_vec(&Cursor {
        version: 1,
        scope: scope.clone(),
        key,
    })
    .context("encode viewer cursor")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub(crate) fn page<T>(
    mut items: Vec<T>,
    limit: usize,
    scope: &Scope,
    key: impl Fn(&T) -> Key,
) -> Result<Page<T>> {
    let more = items.len() > limit;
    items.truncate(limit);
    let next_cursor = if more {
        items
            .last()
            .map(|item| encode(scope, key(item)))
            .transpose()?
    } else {
        None
    };
    Ok(Page { items, next_cursor })
}
