//! Known live owner capacities are separate from conservative cache charges.

/// Writer-attributed capacities exclude allocator rounding and retained free pages.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct StoreMemory {
    /// Queue and active-request container and string capacities, excluding BTree nodes.
    pub queue: usize,
    /// Highest known queue capacity.
    pub queue_peak: usize,
    /// Fixed segment allocation and its complete inline position owner.
    pub segment: usize,
    /// Highest fixed segment capacity.
    pub segment_peak: usize,
    /// Flattened records and their traversal storage during a full export.
    pub flatten: usize,
    /// Existing metadata-accounting traversal storage during a full export.
    pub accounting: usize,
    /// Compressed bytes newly owned by the current full export.
    pub compressed: usize,
    /// Captured codec metadata buffers, excluding opaque BTree nodes.
    pub metadata: usize,
    /// Temporary stored-metadata buffers used by the appending encoder.
    pub stored_metadata: usize,
    /// Known buffers of the active writer's borrowed reusable codec.
    pub codec: usize,
    /// Highest active codec buffer capacity observed by the writer.
    pub codec_peak: usize,
    /// Highest simultaneous full-export and stored-metadata buffer capacity.
    pub export_peak: usize,
    /// Simultaneous known queue, segment, and export capacities.
    pub known: usize,
    /// Highest simultaneous known capacity, rather than the sum of component peaks.
    pub known_peak: usize,
    /// Conservative pending-set BTree-node allowance, never measured allocation.
    pub queue_bookkeeping_charge: usize,
    /// Conservative BTree allowance in current metadata, never measured allocation.
    pub metadata_bookkeeping_charge: usize,
    /// Conservative BTree allowance of the temporary stored-metadata clone.
    pub stored_bookkeeping_charge: usize,
    /// Existing active writer encoder reservation, including opaque zlib workspace.
    pub codec_charge: usize,
    /// Highest active writer codec reservation, not its measured allocation.
    pub codec_charge_peak: usize,
}

impl StoreMemory {
    /// Update simultaneous and component peaks after one ownership transition.
    pub fn sample(&mut self) {
        let export = self.flatten
            + self.accounting
            + self.compressed
            + self.metadata
            + self.stored_metadata
            + self.codec;
        self.known = self.queue + self.segment + export;
        self.queue_peak = self.queue_peak.max(self.queue);
        self.segment_peak = self.segment_peak.max(self.segment);
        self.codec_peak = self.codec_peak.max(self.codec);
        self.export_peak = self.export_peak.max(export);
        self.known_peak = self.known_peak.max(self.known);
        self.codec_charge_peak = self.codec_charge_peak.max(self.codec_charge);
    }
}
