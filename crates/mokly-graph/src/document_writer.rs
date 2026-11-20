//! Byte counting for private document records written into the compressor.

use std::io::Write;

/// Count tree bytes while the codec writes into its pooled compressor.
pub(crate) struct TreeWriter<'a> {
    writer: &'a mut dyn Write,
    /// Serialized tree bytes written through this counter.
    pub(crate) bytes: usize,
}

impl<'a> TreeWriter<'a> {
    /// Start counting writes to the supplied compressor.
    pub(crate) fn new(writer: &'a mut dyn Write) -> Self {
        Self { writer, bytes: 0 }
    }
}

impl Write for TreeWriter<'_> {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        let written = self.writer.write(buffer)?;
        self.bytes += written;
        Ok(written)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.writer.flush()
    }
}
