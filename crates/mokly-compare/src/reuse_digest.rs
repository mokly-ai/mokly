//! Structured scalar fences stream into SHA-256 without retaining JSON buffers.

use std::io::{self, Write};

use serde::Serialize;
use sha2::{Digest, Sha256};

pub(crate) fn digest(value: &impl Serialize) -> Option<[u8; 32]> {
    let mut writer = HashWriter(Sha256::new());
    serde_json::to_writer(&mut writer, value).ok()?;
    Some(writer.0.finalize().into())
}

struct HashWriter(Sha256);
impl Write for HashWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.update(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
