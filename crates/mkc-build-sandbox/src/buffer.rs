//! Pure chunk cutting and incremental plain CLI error-code parsing.

use mkc_build_interface::cli_code::MoklyCliCode;
use mkc_build_interface::log::MAX_CHUNK_BYTES;

use crate::redact::Redactor;

/// Per-stream redaction and coalescing state.
pub(crate) struct OutputBuffer {
    redactor: Redactor,
    ready: Vec<u8>,
}

impl OutputBuffer {
    pub(crate) fn new(tokens: [&str; 2]) -> Self {
        Self {
            redactor: Redactor::new(tokens),
            ready: Vec::new(),
        }
    }

    pub(crate) fn push(&mut self, bytes: &[u8], finished: bool) -> Vec<u8> {
        let redacted = self.redactor.push(bytes, finished);
        self.ready.extend_from_slice(&redacted);
        redacted
    }

    pub(crate) fn cut(&mut self, timer: bool, finished: bool) -> Vec<Vec<u8>> {
        let mut chunks = Vec::new();
        while !self.ready.is_empty() {
            let limit = self.ready.len().min(MAX_CHUNK_BYTES);
            let due = timer && chunks.is_empty();
            if !due && !finished && self.ready.len() < MAX_CHUNK_BYTES {
                break;
            }
            let newline = self.ready[..limit]
                .iter()
                .rposition(|byte| *byte == b'\n')
                .map(|index| index + 1);
            let cut = if let Some(newline) = newline {
                newline
            } else if due || finished || self.ready.len() >= MAX_CHUNK_BYTES {
                boundary(&self.ready, limit, finished)
            } else {
                break;
            };
            if cut == 0 {
                break;
            }
            chunks.push(self.ready.drain(..cut).collect());
        }
        chunks
    }
}

/// Move back at most three bytes only for a valid sequence spanning the cut.
/// Invalid bytes and a finished incomplete suffix always drain at the limit.
fn boundary(bytes: &[u8], limit: usize, finished: bool) -> usize {
    if finished && limit == bytes.len() {
        return limit;
    }
    for start in limit.saturating_sub(3)..limit {
        let width = match bytes[start] {
            0xc2..=0xdf => 2,
            0xe0..=0xef => 3,
            0xf0..=0xf4 => 4,
            _ => continue,
        };
        if start + width <= limit {
            continue;
        }
        let sequence = &bytes[start..bytes.len().min(start + width)];
        match str::from_utf8(sequence) {
            Ok(_) => return start,
            Err(error) if error.valid_up_to() == 0 && error.error_len().is_none() => {
                return start;
            }
            Err(_) => {}
        }
    }
    limit
}

/// Retains only the leading error-code grammar, never an unbounded stderr line.
#[derive(Default)]
pub(crate) struct CliError {
    prefix: Vec<u8>,
    pub(crate) last: Option<MoklyCliCode>,
}

impl CliError {
    pub(crate) fn push(&mut self, bytes: &[u8]) {
        for byte in bytes {
            if *byte == b'\n' {
                self.finish_line();
                self.prefix.clear();
            } else if self.prefix.len() < 256 {
                self.prefix.push(*byte);
            }
        }
    }

    pub(crate) fn finish_line(&mut self) {
        if let Some(code) = code(&self.prefix) {
            self.last = Some(code);
        }
    }
}

fn code(line: &[u8]) -> Option<MoklyCliCode> {
    let line = str::from_utf8(line).ok()?;
    let (code, _) = line.strip_prefix("[mokly/")?.split_once("] ")?;
    if code.is_empty()
        || !code
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return None;
    }
    Some(MoklyCliCode::parse(code))
}

#[cfg(test)]
#[path = "_tests_/buffer_tests.rs"]
mod buffer_tests;
