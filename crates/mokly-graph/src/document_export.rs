//! Full export samples visible scratch lifetimes without changing codec output.

use std::io::{BufWriter, Write};

use flate2::write::ZlibEncoder;
use mokly_model::usage::CatalogueUsage;

use crate::cache::Artifact;
use crate::document_capacity;
use crate::document_codec::{EncodedView, Payload};
use crate::document_error::{CodecResult, Result};
use crate::document_metadata::Metadata;
use crate::document_nodes;
use crate::document_writer::TreeWriter;
use crate::export_memory::{ExportBuffer, ExportObserver, Observation};

impl EncodedView {
    pub(crate) fn encode_export(
        artifact: &Artifact,
        writer: &mut BufWriter<ZlibEncoder<Vec<u8>>>,
        observer: Option<&dyn ExportObserver>,
    ) -> Result<Self> {
        if let Some(observer) = observer {
            observer.bytes(
                ExportBuffer::Codec,
                writer.capacity() + writer.get_ref().get_ref().capacity(),
            );
        }
        let result = {
            let _flatten = Observation::new(observer, ExportBuffer::Flatten);
            let payload = Payload {
                tree: artifact
                    .document
                    .as_ref()
                    .map_or_else(Vec::new, |document| {
                        document_nodes::flatten_observed(&document.tree, observer)
                    }),
            };
            let write: Result<(usize, usize)> = (|| {
                writer.write_all(&artifact.bytes).codec()?;
                let tree_len = {
                    let mut counter = TreeWriter::new(writer);
                    postcard::to_io(&payload, &mut counter).codec()?;
                    counter.bytes
                };
                writer.flush().codec()?;
                Ok((tree_len, payload.tree.len()))
            })();
            if let Some(observer) = observer {
                observer.bytes(ExportBuffer::Codec, writer.capacity());
                observer.bytes(
                    ExportBuffer::Compressed,
                    writer.get_ref().get_ref().capacity(),
                );
            }
            write
        };
        if result.is_err() {
            writer.flush().codec()?;
        }
        let payload = writer.get_mut().reset(Vec::new()).codec()?;
        let (tree_len, records) = result?;
        let metadata = Metadata::capture(artifact);
        if let Some(observer) = observer {
            let (bytes, charge) = metadata.known_bytes();
            observer.bytes(ExportBuffer::Metadata, bytes);
            observer.bytes(ExportBuffer::Bookkeeping, charge);
        }
        let encoded = Self::from_payload(artifact, metadata, payload, tree_len, records, observer);
        Ok(encoded)
    }
}

impl Metadata {
    fn known_bytes(&self) -> (usize, usize) {
        let Some(metadata) = &self.document else {
            return (self.content_type.capacity(), 0);
        };
        let (usage, charge) = match &metadata.usage {
            CatalogueUsage::Ready {
                instances,
                slots,
                ranges,
            } => document_capacity::usage(instances, slots, ranges),
            _ => (0, 0),
        };
        (
            self.content_type.capacity()
                + usage
                + document_capacity::warnings(&metadata.warnings)
                + document_capacity::strings(&metadata.resources)
                + document_capacity::strings(&metadata.components)
                + document_capacity::links(&metadata.links),
            charge,
        )
    }
}
