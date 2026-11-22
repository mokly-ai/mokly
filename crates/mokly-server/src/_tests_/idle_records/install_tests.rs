//! Records install only into the snapshot that the step read or installed last, and an install
//! publishes nothing.

use std::sync::Arc;

use mokly_model::namespace::viewer;
use tokio::sync::broadcast::error::TryRecvError;

use crate::publication::{PublicationWriter, Publications};

use super::support::{changed, primed, same_bytes};

#[tokio::test]
async fn records_install_only_into_the_current_snapshot_and_publish_nothing() {
    let session = changed(4);
    let read = session.shared.current();
    let mut updates = session.shared.subscribe().updates;
    let mut records = read.recent_details.clone();
    records.prime(
        read.details["screen-0"].clone(),
        read.files[&viewer("entries/screen-0.json")].clone(),
    );
    let copy = Arc::new((*read).clone());
    assert!(
        session
            .shared
            .install_records(&copy, records.clone())
            .is_none(),
        "a snapshot that the step did not read"
    );
    assert!(Arc::ptr_eq(&session.shared.current(), &read));
    let installed = session.shared.install_records(&read, records.clone());
    assert!(
        installed
            .as_ref()
            .is_some_and(|installed| Arc::ptr_eq(installed, &session.shared.current())),
        "the snapshot that the step read takes the records"
    );
    let installed = installed.unwrap();
    assert_eq!(
        (
            installed.index.revision,
            primed(&installed),
            updates.try_recv().err()
        ),
        (read.index.revision, 1, Some(TryRecvError::Empty)),
        "the revision, the primed paths, and the events"
    );
    same_bytes(&installed, &read, "the install").await;
    assert!(
        session
            .shared
            .install_records(&read, records.clone())
            .is_none(),
        "the snapshot that the step read before its last install"
    );
    session.shared.candidate();
    assert_eq!(
        (
            session.shared.accepts_records(),
            session
                .shared
                .install_records(&installed, records.clone())
                .is_none()
        ),
        (false, true),
        "after a rebuild candidate"
    );
    let closed = changed(4);
    closed.shared.close();
    assert_eq!(
        (
            closed.shared.accepts_records(),
            closed
                .shared
                .install_records(&closed.shared.current(), records)
                .is_none()
        ),
        (false, true),
        "after Serve closes"
    );
}
