//! Validated replacement segments update one complete snapshot under maintenance ownership.

use std::sync::Arc;

use mokly_graph::document_store::StoreKey;

use crate::render_segment::Header;
use crate::render_store::{CachedDocuments, SegmentIdentity, SegmentPosition};

impl CachedDocuments {
    /// Adopt a whole segment without replacing keys that moved to another segment.
    pub(crate) fn adopt_segment(&self, segment: Arc<SegmentIdentity>, header: &Header) {
        let Ok(_maintenance) = self.maintenance.try_lock() else {
            return;
        };
        let Some(snapshot) = self.index.load_full() else {
            return;
        };
        let mut updated = None;
        for document in &header.documents {
            let key = StoreKey(document.key.clone());
            let Some(position) = snapshot.get(&key) else {
                continue;
            };
            if position.segment.key != segment.key
                || (position.segment.token == segment.token
                    && position.segment.bytes == segment.bytes
                    && position.segment.header_digest == segment.header_digest
                    && position.segment.start == segment.start)
            {
                continue;
            }
            let entries = updated.get_or_insert_with(|| snapshot.as_ref().clone());
            entries.insert(
                key,
                SegmentPosition {
                    segment: segment.clone(),
                    offset: document.offset,
                    length: document.bytes,
                    digest: document.digest.clone(),
                },
            );
        }
        if let Some(entries) = updated {
            self.index.store(Some(Arc::new(entries)));
        }
    }
}
