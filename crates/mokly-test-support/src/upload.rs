//! An independent reader of upload metadata v2 with the receiver's rules.

use std::sync::LazyLock;

use chrono::{DateTime, SecondsFormat, Utc};
use regex::Regex;
use serde_json::{Map, Value};

use crate::strict_json;

/// Why an independent receiver rejects an upload file.
#[derive(Debug, PartialEq, Eq)]
pub enum Rejection {
    /// A file or a field passes its size limit.
    TooLarge,
    /// The format number is not the supported one.
    UnsupportedVersion,
    /// The content breaks a rule.
    Invalid,
}

/// The exact field names of upload metadata v2, in sorted order.
const FIELDS: [&str; 11] = [
    "baseRef",
    "baseSha",
    "branch",
    "comparisonPath",
    "configPath",
    "exportedAt",
    "headSha",
    "moklyVersion",
    "pullRequest",
    "repository",
    "schemaVersion",
];

static TIMESTAMP: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$").unwrap());
static COMMIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:[a-f0-9]{40}|[a-f0-9]{64})$").unwrap());
static HOST_LABEL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$").unwrap());
static NAME_PART: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_.-]+$").unwrap());
static COMPARISON: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^mokly-viewer/diffs/generations/[a-f0-9]{64}/review\.json$").unwrap()
});
static VERSION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$",
    )
    .unwrap()
});
static IDENTIFIER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[0-9A-Za-z-]+$").unwrap());

/// Read upload metadata v2, or return the receiver's rejection.
pub fn metadata(bytes: &[u8]) -> Result<Map<String, Value>, Rejection> {
    if bytes.len() > 16_384 {
        return Err(Rejection::TooLarge);
    }
    let value = object(strict_json::decode(bytes))?;
    match value.get("schemaVersion") {
        None => return Err(Rejection::Invalid),
        Some(version) if version != 2 => return Err(Rejection::UnsupportedVersion),
        Some(_) => {}
    }
    let mut keys: Vec<_> = value.keys().map(String::as_str).collect();
    keys.sort_unstable();
    let version = value["moklyVersion"].as_str();
    let pull_request = &value["pullRequest"];
    let valid = keys == FIELDS
        && text(&value["moklyVersion"], 255)
        && version.is_some_and(semantic_version)
        && repository(&value["repository"])
        && text(&value["branch"], 255)
        && commit(&value["headSha"])
        && value["configPath"]
            .as_str()
            .is_some_and(|path| portable(path) && path.len() <= 1024)
        && value["exportedAt"].as_str().is_some_and(timestamp)
        && (pull_request.is_null() || pull_request.as_f64().is_some_and(safe_positive))
        && comparison(&value);
    if valid {
        Ok(value)
    } else {
        Err(Rejection::Invalid)
    }
}

/// The JSON object in `value`, or an invalid rejection.
pub(crate) fn object(value: Option<Value>) -> Result<Map<String, Value>, Rejection> {
    match value {
        Some(Value::Object(object)) => Ok(object),
        _ => Err(Rejection::Invalid),
    }
}

/// Whether `value` has no control characters, no `\` or `:`, and no empty, `.`, or `..` part.
pub(crate) fn portable(value: &str) -> bool {
    !value.is_empty()
        && !controls(value)
        && !value.contains(['\\', ':'])
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

fn controls(value: &str) -> bool {
    value.chars().any(|character| {
        let point = u32::from(character);
        point < 32 || (127..=159).contains(&point)
    })
}

fn text(value: &Value, max: usize) -> bool {
    value
        .as_str()
        .is_some_and(|text| !text.is_empty() && text.len() <= max && !controls(text))
}

fn commit(value: &Value) -> bool {
    value.as_str().is_some_and(|text| COMMIT.is_match(text))
}

fn safe_positive(value: f64) -> bool {
    value.fract() == 0.0 && value > 0.0 && value <= 9_007_199_254_740_991.0
}

fn timestamp(value: &str) -> bool {
    TIMESTAMP.is_match(value)
        && DateTime::parse_from_rfc3339(value).is_ok_and(|parsed| {
            parsed
                .with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true)
                == value
        })
}

fn semantic_version(value: &str) -> bool {
    let Some(parts) = VERSION.captures(value) else {
        return false;
    };
    let identifiers = |index: usize| parts.get(index).map(|part| part.as_str().split('.'));
    [4, 5].into_iter().all(|index| {
        identifiers(index).is_none_or(|mut items| items.all(|item| IDENTIFIER.is_match(item)))
    }) && identifiers(4).is_none_or(|mut items| {
        items.all(|item| {
            !item.bytes().all(|byte| byte.is_ascii_digit()) || item == "0" || !item.starts_with('0')
        })
    })
}

fn repository(value: &Value) -> bool {
    let Some(repository) = value.as_object() else {
        return false;
    };
    let mut keys: Vec<_> = repository.keys().map(String::as_str).collect();
    keys.sort_unstable();
    keys == ["host", "name", "owner"]
        && text(&repository["host"], 253)
        && repository["host"]
            .as_str()
            .is_some_and(|host| host.split('.').all(|label| HOST_LABEL.is_match(label)))
        && [("owner", true), ("name", false)]
            .into_iter()
            .all(|(key, nested)| name(&repository[key], nested))
}

fn name(value: &Value, nested: bool) -> bool {
    text(value, 255)
        && value.as_str().is_some_and(|item| {
            (nested || !item.contains('/'))
                && item
                    .split('/')
                    .all(|part| NAME_PART.is_match(part) && part != "." && part != "..")
        })
}

fn comparison(value: &Map<String, Value>) -> bool {
    if value["comparisonPath"].is_null() {
        value["baseRef"].is_null() && value["baseSha"].is_null()
    } else {
        text(&value["baseRef"], 255)
            && commit(&value["baseSha"])
            && value["comparisonPath"]
                .as_str()
                .is_some_and(|path| COMPARISON.is_match(path))
    }
}

#[cfg(test)]
#[path = "_tests_/upload_tests.rs"]
mod upload_tests;
