//! Shared secret matching for literal and percent-encoded text.

use std::fmt;

use url::Url;

/// Credential value retained in memory without exposing it in diagnostics.
#[derive(Clone, Default, Eq, PartialEq)]
pub struct Secret(String);

impl Secret {
    /// Store a credential value exactly as supplied, before validation.
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// Expose the value only to validation, matching, and the HTTP header.
    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Return true when the supplied credential has no characters.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl fmt::Debug for Secret {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Secret([redacted])")
    }
}

/// Matches a secret in literal text and percent-encoded bytes.
#[derive(Clone, Debug)]
pub struct SecretMatcher {
    secret: Secret,
}

#[cfg(test)]
#[path = "_tests_/redaction_tests.rs"]
mod redaction_tests;

impl SecretMatcher {
    /// Create a matcher for one secret value.
    pub fn new(secret: impl Into<String>) -> Self {
        Self {
            secret: Secret::new(secret),
        }
    }

    /// Return the literal secret length for redaction ordering.
    pub fn len(&self) -> usize {
        self.secret.expose().len()
    }

    /// Return true when the matcher has no secret bytes.
    pub fn is_empty(&self) -> bool {
        self.secret.is_empty()
    }

    /// Return true when text contains the literal or encoded secret.
    pub fn contains(&self, text: &str) -> bool {
        self.find(text).is_some()
    }

    /// Return true when a URL or its parsed host contains the secret.
    ///
    /// The serialized URL keeps exact matching for paths, queries, fragments,
    /// and user information. The parsed host is checked with ASCII-insensitive
    /// matching because URL parsing normalizes host names independently of the
    /// spelling used in the input URL.
    pub fn contains_url(&self, url: &Url) -> bool {
        self.contains(url.as_str())
            || url.host_str().is_some_and(|host| {
                self.find_with_mode(host, MatchMode::AsciiInsensitive)
                    .is_some()
            })
    }

    /// Replace every literal or encoded secret with a redaction marker.
    pub fn redact(&self, text: &str) -> String {
        let Some(first) = self.find(text) else {
            return text.to_owned();
        };
        let mut output = String::with_capacity(text.len());
        let mut cursor = 0;
        let mut match_range = Some(first);
        while let Some((start, end)) = match_range {
            output.push_str(&text[cursor..start]);
            output.push_str("[redacted]");
            cursor = end;
            match_range = self
                .find(&text[cursor..])
                .map(|(start, end)| (cursor + start, cursor + end));
        }
        output.push_str(&text[cursor..]);
        output
    }

    fn find(&self, text: &str) -> Option<(usize, usize)> {
        self.find_with_mode(text, MatchMode::Exact)
    }

    /// Find a match and return only UTF-8 character-boundary offsets.
    fn find_with_mode(&self, text: &str, mode: MatchMode) -> Option<(usize, usize)> {
        if self.secret.is_empty() {
            return None;
        }
        let input = text.as_bytes();
        let secret = self.secret.expose().as_bytes();
        let mut current = Vec::new();
        let mut next = Vec::new();
        for start in 0..input.len() {
            if !text.is_char_boundary(start) {
                continue;
            }
            current.clear();
            current.push(start);
            for expected in secret {
                next.clear();
                for &cursor in &current {
                    let Some(&byte) = input.get(cursor) else {
                        continue;
                    };
                    if equal(byte, *expected, mode) {
                        next.push(cursor + 1);
                    }
                    if byte == b'%' {
                        let Some(decoded) = input.get(cursor + 1..cursor + 3).and_then(hex_pair)
                        else {
                            continue;
                        };
                        if equal(decoded, *expected, mode) {
                            next.push(cursor + 3);
                        }
                    }
                }
                next.sort_unstable();
                next.dedup();
                if next.is_empty() {
                    current.clear();
                    break;
                }
                std::mem::swap(&mut current, &mut next);
            }
            if let Some(&end) = current
                .iter()
                .rev()
                .find(|&&end| text.is_char_boundary(end))
            {
                return Some((start, end));
            }
        }
        None
    }
}

#[derive(Clone, Copy)]
enum MatchMode {
    Exact,
    AsciiInsensitive,
}

fn equal(actual: u8, expected: u8, mode: MatchMode) -> bool {
    match mode {
        MatchMode::Exact => actual == expected,
        MatchMode::AsciiInsensitive => actual.eq_ignore_ascii_case(&expected),
    }
}

fn hex_pair(bytes: &[u8]) -> Option<u8> {
    if bytes.len() != 2 {
        return None;
    }
    Some(hex(bytes[0])? * 16 + hex(bytes[1])?)
}

fn hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
