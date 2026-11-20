//! Streaming byte redaction that retains possible split-token prefixes.

use std::cmp::Reverse;

/// Pure redaction state; never formats retained credential or output bytes.
pub(crate) struct Redactor {
    secrets: Vec<Vec<u8>>,
    pending: Vec<u8>,
    hold: usize,
}

impl Redactor {
    pub(crate) fn new(tokens: [&str; 2]) -> Self {
        let mut secrets: Vec<_> = tokens
            .into_iter()
            .map(|token| token.as_bytes().to_vec())
            .collect();
        secrets.sort_by_key(|value| Reverse(value.len()));
        let hold = secrets
            .first()
            .map_or(0, |secret| secret.len().saturating_sub(1));
        Self {
            secrets,
            pending: Vec::new(),
            hold,
        }
    }

    pub(crate) fn push(&mut self, bytes: &[u8], finished: bool) -> Vec<u8> {
        self.pending.extend_from_slice(bytes);
        let safe = if finished {
            self.pending.len()
        } else {
            self.pending.len().saturating_sub(self.hold)
        };
        let mut output = Vec::new();
        let mut index = 0;
        while index < safe {
            let matched = self
                .secrets
                .iter()
                .find(|secret| !secret.is_empty() && self.pending[index..].starts_with(secret));
            if let Some(secret) = matched {
                output.extend_from_slice(b"[redacted]");
                index += secret.len();
            } else {
                output.push(self.pending[index]);
                index += 1;
            }
        }
        self.pending.drain(..index);
        output
    }
}

#[cfg(test)]
#[path = "_tests_/redact_tests.rs"]
mod redact_tests;
