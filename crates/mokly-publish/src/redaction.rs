//! Shared secret matching for literal and percent-encoded text.

use url::Url;

/// Matches a secret in literal text and percent-encoded bytes.
#[derive(Clone, Debug)]
pub struct SecretMatcher {
    secret: String,
}

impl SecretMatcher {
    /// Create a matcher for one secret value.
    pub fn new(secret: impl Into<String>) -> Self {
        Self {
            secret: secret.into(),
        }
    }

    /// Return the literal secret length for redaction ordering.
    pub fn len(&self) -> usize {
        self.secret.len()
    }

    /// Return true when the matcher has no secret bytes.
    pub fn is_empty(&self) -> bool {
        self.secret.is_empty()
    }

    /// Return true when text contains the literal or encoded secret.
    pub fn contains(&self, text: &str) -> bool {
        self.find(text).is_some()
    }

    /// Return true when a URL contains the secret in any serialized component.
    pub fn contains_url(&self, url: &Url) -> bool {
        self.contains(url.as_str())
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
        if self.secret.is_empty() {
            return None;
        }
        let input = text.as_bytes();
        let secret = self.secret.as_bytes();
        for start in 0..input.len() {
            let mut cursor = start;
            let mut matched = true;
            for expected in secret {
                let Some(&byte) = input.get(cursor) else {
                    matched = false;
                    break;
                };
                if byte == b'%' {
                    let Some(bytes) = input.get(cursor + 1..cursor + 3) else {
                        matched = false;
                        break;
                    };
                    let Some(decoded) = hex_pair(bytes) else {
                        matched = false;
                        break;
                    };
                    if decoded != *expected {
                        matched = false;
                        break;
                    }
                    cursor += 3;
                } else if byte == *expected {
                    cursor += 1;
                } else {
                    matched = false;
                    break;
                }
            }
            if matched {
                return Some((start, cursor));
            }
        }
        None
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
