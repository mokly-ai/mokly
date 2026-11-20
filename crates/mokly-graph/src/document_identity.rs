//! Framed codec input hashes stream beside compression without retaining a second payload.

use std::io::{self, BufWriter, Write};

use sha2::{Digest, Sha256};

use crate::comparison_proof::ContentIdentity;
use crate::document_error::{CodecResult, Result};
use crate::document_metadata::Metadata;

pub(crate) struct IdentityWriter<'a> {
    writer: &'a mut dyn Write,
    hash: Sha256,
}

impl<'a> IdentityWriter<'a> {
    pub(crate) fn new(writer: &'a mut dyn Write, bytes_len: usize) -> Self {
        let mut hash = Sha256::new();
        hash.update(b"mokly-comparison-document-v1");
        hash.update(bytes_len.to_le_bytes());
        Self { writer, hash }
    }

    /// Raw bytes have a length prefix. Flat records start with their record count.
    /// The encoded tree length ends that self-delimiting section before JSON metadata.
    pub(crate) fn finish(
        mut self,
        tree_len: usize,
        metadata: &Metadata,
    ) -> Result<ContentIdentity> {
        self.hash.update(tree_len.to_le_bytes());
        {
            let mut writer = BufWriter::new(HashWriter(&mut self.hash));
            serde_json::to_writer(&mut writer, metadata).codec()?;
            writer.flush().codec()?;
        }
        Ok(self.hash.finalize().into())
    }
}

impl Write for IdentityWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let written = self.writer.write(bytes)?;
        self.hash.update(&bytes[..written]);
        Ok(written)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.writer.flush()
    }
}

struct HashWriter<'a>(&'a mut Sha256);

impl Write for HashWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.update(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
