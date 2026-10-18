//! Asset copies observe cancellation at each bounded delivery chunk.

use std::io::{self, Write};
use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::error::{Result, SourceError};
use mokly_source_interface::stream::SourceStream;

use crate::cancellation::Cancellation;

pub(crate) struct CancellableStream {
    pub(crate) inner: Box<dyn SourceStream>,
    pub(crate) cancellation: Arc<dyn Cancellation>,
}

impl SourceStream for CancellableStream {
    fn length(&self) -> u64 {
        self.inner.length()
    }
    fn copy_verified(&mut self, path: &Path, expected: &str, output: &mut dyn Write) -> Result<()> {
        if self.cancellation.requested() {
            return Err(cancelled(path));
        }
        let result = self.inner.copy_verified(
            path,
            expected,
            &mut CancellableWriter {
                inner: output,
                cancellation: self.cancellation.as_ref(),
            },
        );
        if self.cancellation.requested() {
            Err(cancelled(path))
        } else {
            result
        }
    }
}

struct CancellableWriter<'a> {
    inner: &'a mut dyn Write,
    cancellation: &'a dyn Cancellation,
}

impl Write for CancellableWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.cancellation.requested() {
            return Err(io::Error::other("asset copy cancelled"));
        }
        self.inner.write(bytes)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

fn cancelled(path: &Path) -> SourceError {
    SourceError::Io {
        operation: "cancelled",
        path: path.into(),
        source: io::ErrorKind::Interrupted.into(),
    }
}

#[cfg(test)]
#[path = "_tests_/cancelled_stream_tests.rs"]
mod cancelled_stream_tests;
