//! Snapshot event capture shared by the existing runner recovery scenarios.

use std::path::Path;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::snapshot::contracts::{
    Ownership, SnapshotCreateMock, SnapshotHandle, SnapshotRemoveMock,
};

/// Mock lifecycle operations while retaining exactly when ownership is released.
pub(super) fn snapshot(events: Arc<Mutex<Vec<String>>>) -> Arc<Unimock> {
    let created = events.clone();
    Arc::new(Unimock::new((
        SnapshotCreateMock
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, run, _| {
                created.lock().unwrap().push("snapshot:create".into());
                let mut handle = SnapshotHandle::paths(Path::new("/workspace"), run);
                handle.ownership = Ownership::Linked;
                Ok(handle)
            })),
        SnapshotRemoveMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                events.lock().unwrap().push("snapshot:remove".into());
                Ok(())
            })),
    )))
}
