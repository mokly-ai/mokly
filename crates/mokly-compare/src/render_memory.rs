//! Writer scratch updates share the complete diagnostic publication owner.

use std::sync::Arc;

use mokly_graph::export_memory::{ExportBuffer, ExportObserver};
use mokly_graph::store_memory::StoreMemory;

use crate::render_pending::Shared;

pub(crate) struct ExportMemory(pub(crate) Arc<Shared>);
impl ExportObserver for ExportMemory {
    fn bytes(&self, buffer: ExportBuffer, bytes: usize) {
        self.0.memory(Some(buffer), bytes);
    }
}

pub(crate) struct SegmentMemory(pub(crate) Arc<Shared>);
impl Drop for SegmentMemory {
    fn drop(&mut self) {
        self.0.memory(None, 0);
    }
}

pub(crate) fn update(memory: &mut StoreMemory, buffer: Option<ExportBuffer>, bytes: usize) {
    match buffer {
        None => memory.segment = bytes,
        Some(ExportBuffer::Flatten) => memory.flatten = bytes,
        Some(ExportBuffer::Accounting) => memory.accounting = bytes,
        Some(ExportBuffer::Compressed) => memory.compressed = bytes,
        Some(ExportBuffer::Metadata) => memory.metadata = bytes,
        Some(ExportBuffer::StoredMetadata) => memory.stored_metadata = bytes,
        Some(ExportBuffer::Codec) => memory.codec = bytes,
        Some(ExportBuffer::Bookkeeping) => memory.metadata_bookkeeping_charge = bytes,
        Some(ExportBuffer::StoredBookkeeping) => memory.stored_bookkeeping_charge = bytes,
        Some(ExportBuffer::CodecCharge) => memory.codec_charge = bytes,
    }
    memory.sample();
}
