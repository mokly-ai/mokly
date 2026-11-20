//! IO adapters that never read more than one byte beyond a ceiling.

use std::cell::Cell;
use std::io::{self, Read};

pub(crate) struct Budget<'a> {
    pub(crate) inner: &'a mut dyn Read,
    pub(crate) remaining: u64,
    pub(crate) exceeded: &'a Cell<bool>,
}

impl Read for Budget<'_> {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        if bytes.is_empty() {
            return Ok(0);
        }
        if self.exceeded.get() {
            return Err(io::Error::from(io::ErrorKind::InvalidData));
        }
        let count = bytes.len().min(self.remaining.saturating_add(1) as usize);
        let read = self.inner.read(&mut bytes[..count])?;
        if read as u64 > self.remaining {
            self.exceeded.set(true);
            return Err(io::Error::from(io::ErrorKind::InvalidData));
        }
        self.remaining -= read as u64;
        Ok(read)
    }
}
