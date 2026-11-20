//! Optional capacity observations do not alter cache reservations or compaction.

/// Independently owned export buffers and their separate accounting charges.
#[derive(Clone, Copy)]
pub enum ExportBuffer {
    /// Flat records and traversal references.
    Flatten,
    /// Temporary traversal storage used by existing metadata accounting.
    Accounting,
    /// Newly compressed output.
    Compressed,
    /// Metadata captured by a full export.
    Metadata,
    /// Metadata cloned for private storage.
    StoredMetadata,
    /// Known reusable codec buffers.
    Codec,
    /// Conservative metadata BTree allowance.
    Bookkeeping,
    /// Conservative BTree allowance in the stored-metadata clone.
    StoredBookkeeping,
    /// Existing active encoder workspace reservation.
    CodecCharge,
}

/// One writer-owned ledger observes real allocation lifetimes synchronously.
pub trait ExportObserver: Send + Sync {
    /// Replace one current owner capacity or charge.
    fn bytes(&self, buffer: ExportBuffer, bytes: usize);
}

pub(crate) struct Observation<'a> {
    observer: Option<&'a dyn ExportObserver>,
    buffer: ExportBuffer,
}
impl<'a> Observation<'a> {
    pub(crate) fn new(observer: Option<&'a dyn ExportObserver>, buffer: ExportBuffer) -> Self {
        Self { observer, buffer }
    }
    pub(crate) fn set(&self, bytes: usize) {
        if let Some(observer) = self.observer {
            observer.bytes(self.buffer, bytes);
        }
    }
}
impl Drop for Observation<'_> {
    fn drop(&mut self) {
        self.set(0);
    }
}

pub(crate) struct ExportScope<'a>(pub(crate) Option<&'a dyn ExportObserver>);
impl Drop for ExportScope<'_> {
    fn drop(&mut self) {
        if let Some(observer) = self.0 {
            for buffer in [
                ExportBuffer::Flatten,
                ExportBuffer::Accounting,
                ExportBuffer::Compressed,
                ExportBuffer::Metadata,
                ExportBuffer::StoredMetadata,
                ExportBuffer::Codec,
                ExportBuffer::Bookkeeping,
                ExportBuffer::StoredBookkeeping,
                ExportBuffer::CodecCharge,
            ] {
                observer.bytes(buffer, 0);
            }
        }
    }
}
