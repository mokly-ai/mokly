//! Bounded binary pipe draining that terminates the owner on failure.

use std::io::{Read, Write};

use mokly_platform::processes::ProcessGroup;
use sha2::{Digest, Sha256};

use crate::error::{Error, InternalError, IoResult, Result};

pub(crate) fn capture(
    reader: impl Read,
    limit: usize,
    group: &dyn ProcessGroup,
) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let result = reader
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut bytes);
    if result.is_err() || bytes.len() > limit {
        let _ = group.kill();
        result.git()?;
        return Err(Error::OutputLimit { limit });
    }
    Ok(bytes)
}

/// Keep only one chunk and the hash state, regardless of blob size.
pub(crate) fn digest(mut reader: impl Read, group: &dyn ProcessGroup) -> Result<Vec<u8>> {
    let mut hash = Sha256::new();
    let mut chunk = [0u8; 64 * 1024];
    loop {
        let count = match reader.read(&mut chunk) {
            Ok(count) => count,
            Err(source) => {
                let _ = group.kill();
                return Err(InternalError::Io { source }.into());
            }
        };
        if count == 0 {
            break;
        }
        hash.update(&chunk[..count]);
    }
    Ok(hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
        .into_bytes())
}

/// Copy one proved blob with bounded memory and exact size validation.
pub(crate) fn copy(
    reader: &mut dyn Read,
    output: &mut dyn Write,
    bytes: usize,
    group: &dyn ProcessGroup,
) -> Result<Vec<u8>> {
    copy_stream(reader, output, bytes, true, group)
}

pub(crate) fn copy_bounded(
    reader: &mut dyn Read,
    output: &mut dyn Write,
    bytes: usize,
    group: &dyn ProcessGroup,
) -> Result<Vec<u8>> {
    match copy_stream(reader, output, bytes, false, group) {
        Err(Error::OutputLimit { limit }) => Err(Error::ByteLimit { limit }),
        other => other,
    }
}

fn copy_stream(
    reader: &mut dyn Read,
    output: &mut dyn Write,
    bytes: usize,
    exact: bool,
    group: &dyn ProcessGroup,
) -> Result<Vec<u8>> {
    let mut total = 0usize;
    let mut chunk = [0u8; 64 * 1024];
    loop {
        let count = match reader.read(&mut chunk) {
            Ok(count) => count,
            Err(source) => {
                let _ = group.kill();
                return Err(InternalError::Io { source }.into());
            }
        };
        if count == 0 {
            if exact && total != bytes {
                let _ = group.kill();
                return Err(Error::MalformedOutput);
            }
            return Ok(Vec::new());
        }
        if count > bytes.saturating_sub(total) {
            let _ = group.kill();
            return Err(Error::OutputLimit { limit: bytes });
        }
        if let Err(source) = output.write_all(&chunk[..count]) {
            let _ = group.kill();
            return Err(InternalError::Io { source }.into());
        }
        total += count;
    }
}

#[cfg(test)]
#[path = "_tests_/pipes_tests.rs"]
mod pipes_tests;
