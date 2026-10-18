//! Copy one opened resource through a bounded buffer and verify its captured digest.

use std::io::{Read, Write};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::{Result, SourceError};

/// One opened source payload, consumed without exposing unchecked bytes to delivery.
#[cfg_attr(feature = "mock", unimock::unimock(api = SourceStreamMock))]
pub trait SourceStream: Send {
    /// Byte length observed at the confined open.
    fn length(&self) -> u64;
    /// Copy into private storage and verify the generation digest before publication.
    fn copy_verified(&mut self, path: &Path, expected: &str, output: &mut dyn Write) -> Result<()>;
}

/// Reader and length bound to an opened file or immutable source object.
pub struct OpenedSource {
    /// The opened payload, independent of later path replacement.
    pub reader: Box<dyn Read + Send>,
    /// Payload length observed at open time.
    pub length: u64,
}

impl SourceStream for OpenedSource {
    fn length(&self) -> u64 {
        self.length
    }
    fn copy_verified(&mut self, path: &Path, expected: &str, output: &mut dyn Write) -> Result<()> {
        let mut hash = Sha256::new();
        let mut copied = 0u64;
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = match self.reader.read(&mut buffer) {
                Ok(count) => count,
                Err(source) => {
                    return Err(SourceError::Io {
                        operation: "stream source",
                        path: path.into(),
                        source,
                    });
                }
            };
            if count == 0 {
                break;
            }
            copied = copied.saturating_add(count as u64);
            if copied > self.length {
                return Err(SourceError::Changed { path: path.into() });
            }
            hash.update(&buffer[..count]);
            if let Err(source) = output.write_all(&buffer[..count]) {
                return Err(SourceError::Io {
                    operation: "write resource",
                    path: path.into(),
                    source,
                });
            }
        }
        let actual: String = hash
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        if copied != self.length || actual != expected {
            return Err(SourceError::Changed { path: path.into() });
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/stream_tests.rs"]
mod stream_tests;
