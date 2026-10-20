//! Verify all observed ranges with one streamed pass and bounded payload memory.

use std::collections::{BTreeSet, VecDeque};
use std::io::{self, Write};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::read_evidence::ReadBaseline;
use crate::tree::SourceTree;

struct Range {
    offset: u64,
    length: u64,
    digest: String,
    seen: u64,
    hash: Sha256,
}

struct Checker {
    pending: VecDeque<Range>,
    active: Vec<Range>,
    cursor: u64,
    eof: u64,
    valid: bool,
}

/// Whole-file callers supply the checked stream digest. Only actual ranges add a pass.
pub fn verify(
    tree: &dyn SourceTree,
    path: &Path,
    versions: &BTreeSet<ReadBaseline>,
    whole_digest: &str,
) -> bool {
    let mut ranges = Vec::new();
    let mut eof = u64::MAX;
    for version in versions {
        if let ReadBaseline::ObservedRange {
            offset,
            length,
            eof: observed_eof,
            digest,
        } = version
        {
            let Some(end) = offset.checked_add(*length) else {
                return false;
            };
            if *observed_eof {
                eof = eof.min(end);
            }
            ranges.push(Range {
                offset: *offset,
                length: *length,
                digest: digest.clone(),
                seen: 0,
                hash: Sha256::new(),
            });
        }
    }
    if ranges.is_empty() {
        return true;
    }
    ranges.sort_by_key(|range| range.offset);
    let mut checker = Checker {
        pending: ranges.into(),
        active: Vec::new(),
        cursor: 0,
        eof,
        valid: true,
    };
    let Ok(mut stream) = tree.open_stream(path) else {
        return false;
    };
    if stream
        .copy_verified(path, whole_digest, &mut checker)
        .is_err()
    {
        return false;
    }
    checker.finish()
}

impl Checker {
    fn complete(&mut self, range: Range) {
        let actual: String = range
            .hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        self.valid &= range.seen == range.length && actual == range.digest;
    }

    fn finish(mut self) -> bool {
        while let Some(range) = self.pending.pop_front() {
            self.complete(range);
        }
        for range in std::mem::take(&mut self.active) {
            self.complete(range);
        }
        self.valid && self.cursor <= self.eof
    }
}

impl Write for Checker {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let end = self.cursor.saturating_add(bytes.len() as u64);
        while self.pending.front().is_some_and(|range| range.offset < end) {
            if let Some(range) = self.pending.pop_front() {
                self.active.push(range);
            }
        }
        let mut remaining = Vec::new();
        for mut range in std::mem::take(&mut self.active) {
            let first = self.cursor.max(range.offset);
            let last = end.min(range.offset.saturating_add(range.length));
            if first < last {
                range
                    .hash
                    .update(&bytes[(first - self.cursor) as usize..(last - self.cursor) as usize]);
                range.seen += last - first;
            }
            if range.seen == range.length {
                self.complete(range);
            } else {
                remaining.push(range);
            }
        }
        self.active = remaining;
        self.cursor = end;
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/range_evidence_tests.rs"]
mod range_evidence_tests;
