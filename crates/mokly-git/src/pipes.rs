//! Bounded binary pipe draining that terminates the owner on failure.

use std::io::Read;

use mokly_platform::processes::ProcessGroup;

use crate::error::{Error, IoResult, Result};

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
