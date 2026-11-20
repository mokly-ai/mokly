//! Pure normalization and navigation safety rules.

use std::borrow::Cow;

use percent_encoding::percent_decode_str;

use crate::app_paths::DASHBOARD;
use crate::slug::is_site_first_segment;

/// Normalize one email recipient, rejecting ambiguous mail header syntax.
pub fn email(value: &str) -> Option<String> {
    let value = value.trim().to_ascii_lowercase();
    let (local, domain) = value.split_once('@')?;
    if value.len() > 254
        || local.is_empty()
        || domain.is_empty()
        || domain.contains('@')
        || !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
        || value
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || ",<>;\"".contains(c))
    {
        return None;
    }
    Some(value)
}

/// Trim and validate a product display name.
pub fn name(value: &str) -> Option<String> {
    let value = value.trim();
    (1..=80)
        .contains(&value.chars().count())
        .then_some(value)
        .filter(|s| !s.chars().any(char::is_control))
        .map(str::to_owned)
}

/// Validate a repository-relative JSON configuration path.
pub fn config_path(value: &str) -> bool {
    value.ends_with(".json")
        && value.len() <= 512
        && !value.contains('\\')
        && !value.chars().any(char::is_control)
        && value
            .split('/')
            .all(|part| !matches!(part, "" | "." | ".."))
        && !value.contains(':')
}

/// Validate an owner/repository identity reported by GitHub before it is stored.
pub fn repository(value: &str) -> bool {
    let parts: Vec<_> = value.split('/').collect();
    parts.len() == 2
        && parts.iter().all(|part| {
            !matches!(*part, "" | "." | "..")
                && part.len() <= 100
                && part
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
        })
}

/// Restore a safe relative product destination without changing canonical bytes.
pub fn return_to(value: Option<&str>) -> String {
    let Some(value) = value else {
        return DASHBOARD.to_owned();
    };
    let Some(value) = normalize_legacy_return_to(value) else {
        return DASHBOARD.to_owned();
    };
    let without_fragment = value
        .split_once('#')
        .map_or(value.as_ref(), |(path, _)| path);
    let (path, query) = without_fragment
        .split_once('?')
        .map_or((without_fragment, None), |(path, query)| {
            (path, Some(query))
        });
    if safe_return_path(path) && query.is_none_or(safe_return_query) {
        without_fragment.to_owned()
    } else {
        DASHBOARD.to_owned()
    }
}

fn normalize_legacy_return_to(value: &str) -> Option<Cow<'_, str>> {
    if value.starts_with('/') {
        return Some(Cow::Borrowed(value));
    }
    value
        .get(..3)
        .filter(|prefix| prefix.eq_ignore_ascii_case("%2f"))?;
    strict_percent_decode(value, false)
}

fn safe_return_path(path: &str) -> bool {
    if contains_encoded_path_delimiter(path) {
        return false;
    }
    let Some(path) = strict_percent_decode(path, false) else {
        return false;
    };
    let first_segment = path
        .strip_prefix('/')
        .and_then(|value| value.split('/').next())
        .unwrap_or_default();
    let account_or_callback = matches!(first_segment, "sign-in" | "sign-up")
        || path == "/auth"
        || path.starts_with("/auth/");
    path.starts_with('/')
        && path != "/"
        && !is_site_first_segment(first_segment)
        && !account_or_callback
        && !path.contains(['\\', '%'])
        && !path.contains("//")
        && !path.contains(':')
        && !path.chars().any(char::is_control)
        && !path.split('/').any(|segment| matches!(segment, "." | ".."))
}

fn contains_encoded_path_delimiter(path: &str) -> bool {
    path.as_bytes().windows(3).any(|window| {
        window[0] == b'%'
            && matches!(
                (
                    window[1].to_ascii_lowercase(),
                    window[2].to_ascii_lowercase()
                ),
                (b'2', b'f' | b'3') | (b'3', b'f')
            )
    })
}

fn safe_return_query(query: &str) -> bool {
    query.split('&').all(|pair| {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        let Some(key) = strict_percent_decode(key, true) else {
            return false;
        };
        !key.chars().any(char::is_control)
            && !matches_ignore_ascii_case(&key, &["token", "secret", "code", "session"])
            && strict_percent_decode(value, false)
                .is_some_and(|value| !value.chars().any(char::is_control))
    })
}

fn strict_percent_decode(value: &str, form: bool) -> Option<Cow<'_, str>> {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return None;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    if form && value.contains('+') {
        let form_value = value.replace('+', " ");
        return percent_decode_str(&form_value)
            .decode_utf8()
            .ok()
            .map(|decoded| Cow::Owned(decoded.into_owned()));
    }
    percent_decode_str(value).decode_utf8().ok()
}

fn matches_ignore_ascii_case(value: &str, candidates: &[&str]) -> bool {
    candidates
        .iter()
        .any(|candidate| value.eq_ignore_ascii_case(candidate))
}

#[cfg(test)]
#[path = "_tests_/validation_tests.rs"]
mod validation_tests;
