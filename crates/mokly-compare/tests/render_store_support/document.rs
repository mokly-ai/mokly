//! Authored complete records use the public fixed segment boundary in store tests.

use mokly_compare::render_segment_buffer::{Append, SegmentBuffer};
use mokly_compare::render_store::{DocumentBackend, WriteOutcome};
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::StoreKey;

pub struct Record {
    pub key: StoreKey,
    pub document: EncodedView,
}

pub fn save(store: &dyn DocumentBackend, records: &[Record]) -> WriteOutcome {
    let mut buffer = SegmentBuffer::new(1024 * 1024).unwrap();
    for record in records {
        assert_eq!(
            buffer.append(&record.key, &record.document, None),
            Append::Added
        );
    }
    store.save(&buffer.finish(store.version()).unwrap())
}
