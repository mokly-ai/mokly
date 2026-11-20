//! Only terminal current Changes state permits writing and the query owns no publication.

use std::sync::Arc;

use mokly_graph::write_activity::WriteReadiness;
use mokly_model::public_metadata::ChangesStatus;
use mokly_server::publication::{Publications, SharedPublication};

use crate::serve_rebuild::serve_rebuild_tests::initial;

use super::CurrentChanges;

#[test]
fn readiness_reads_each_current_terminal_state_without_retaining_its_publication() {
    for (status, expected) in [
        (ChangesStatus::Pending, false),
        (ChangesStatus::Preparing, false),
        (ChangesStatus::Disabled, false),
        (ChangesStatus::Ready, true),
        (ChangesStatus::Unavailable, true),
    ] {
        let query = {
            let mut snapshot = (*initial()).clone();
            snapshot.index.changes_status = status;
            let publications: Arc<dyn Publications> =
                Arc::new(SharedPublication::new(Arc::new(snapshot)));
            let query = CurrentChanges(Arc::downgrade(&publications));
            assert_eq!(query.ready(), expected, "{status:?}");
            query
        };
        assert!(
            !query.ready(),
            "the writer query must not keep a historical graph alive"
        );
    }
}
