//! File fingerprints prove that a leased extraction file still holds its pinned bytes.

use std::fs;
use std::io::{self, Read};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::path::Path;
use std::time::SystemTime;

use sha2::{Digest, Sha256};

use crate::error::{Error, IoResult, Result};

/// What the file system reports about one file's bytes. A write, a
/// truncation, or a replacement of the file changes it.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Fingerprint {
    len: u64,
    modified: Option<SystemTime>,
    #[cfg(unix)]
    changed: (i64, i64),
    #[cfg(unix)]
    identity: (u64, u64),
}

impl Fingerprint {
    pub(crate) fn of(metadata: &fs::Metadata) -> Self {
        Self {
            len: metadata.len(),
            modified: metadata.modified().ok(),
            #[cfg(unix)]
            changed: (metadata.ctime(), metadata.ctime_nsec()),
            #[cfg(unix)]
            identity: (metadata.dev(), metadata.ino()),
        }
    }
}

/// Reads `file` when it still matches `expected` before and after the read;
/// a vanished or changed file returns none.
pub(crate) fn read_pinned(
    file: &Path,
    limit: usize,
    expected: &Fingerprint,
) -> Result<Option<Vec<u8>>> {
    let Some(mut input) = open(file, expected)? else {
        return Ok(None);
    };
    if expected.len > limit as u64 {
        return Err(Error::ByteLimit { limit });
    }
    let mut bytes = Vec::new();
    (&mut input)
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut bytes)
        .git()?;
    if !unchanged(&input, expected)? || bytes.len() as u64 != expected.len {
        return Ok(None);
    }
    Ok(Some(bytes))
}

/// Hashes `file` when it still matches `expected` before and after the hash.
pub(crate) fn digest_pinned(file: &Path, expected: &Fingerprint) -> Result<Option<String>> {
    let Some(mut input) = open(file, expected)? else {
        return Ok(None);
    };
    let mut hash = Sha256::new();
    let mut chunk = vec![0; 64 * 1024];
    loop {
        let count = input.read(&mut chunk).git()?;
        if count == 0 {
            break;
        }
        hash.update(&chunk[..count]);
    }
    if !unchanged(&input, expected)? {
        return Ok(None);
    }
    Ok(Some(
        hash.finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
    ))
}

fn open(file: &Path, expected: &Fingerprint) -> Result<Option<fs::File>> {
    let input = match fs::File::open(file) {
        Ok(input) => input,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(source) => return Err(source).git(),
    };
    Ok(unchanged(&input, expected)?.then_some(input))
}

fn unchanged(input: &fs::File, expected: &Fingerprint) -> Result<bool> {
    Ok(Fingerprint::of(&input.metadata().git()?) == *expected)
}
