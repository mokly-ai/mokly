//! Offers that start only after the writer thread is idle.
//!
//! The writer takes the pending lock for a moment when it starts and after
//! each wake. An offer never waits for that lock, so a test that expects a
//! queued offer first waits until the writer waits for a new epoch.

use mokly_graph::document_store::{DocumentStore, OfferOutcome, StoreKey};
use mokly_graph::key::NodeKey;

use crate::render_writer::DocumentWriter;

/// Offer one key after the writer thread waits for a new admission epoch.
pub(crate) fn offer_when_idle(
    store: &DocumentWriter,
    key: StoreKey,
    document: NodeKey,
) -> OfferOutcome {
    {
        let inner = &store.shared.admission.inner;
        let mut state = inner
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while state.waiting == 0 {
            state = inner
                .changed
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }
    store.offer(key, document)
}
