//! A detail that a later publication shares is served with the current revision.

use std::sync::Arc;

use mokly_model::namespace::viewer;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::readers;
use mokly_server::changes::ChangeToken;
use mokly_server::publication::{PublicationWriter, Publications};
use mokly_server::snapshot::Snapshot;

use super::support::Harness;

/// Publish the Preparing status from the current publication, as a Changes pass does.
fn preparing(harness: &Harness) -> Arc<Snapshot> {
    let current = harness.publications.current();
    assert!(
        harness
            .publications
            .changes(
                &current,
                ChangesStatus::Preparing,
                None,
                &ChangeToken::default(),
                None,
            )
            .unwrap()
    );
    harness.publications.current()
}

#[tokio::test]
async fn a_detail_shared_across_an_edit_serves_the_current_revision() {
    let harness = Harness::new().await;
    let built = preparing(&harness);
    assert!(harness.publications.replace(harness.replacement()));
    let current = preparing(&harness);
    let stored = &current.details["home"];
    assert!(Arc::ptr_eq(stored, &built.details["home"]));
    assert_eq!(current.index.revision, 4);
    assert_eq!(stored.revision, Some(2));
    let text = harness
        .client
        .get(format!("{}/{}", harness.url, viewer("entries/home.json")))
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let served = readers::detail(&text).unwrap();
    assert_eq!(served.revision, Some(4));
    assert_eq!(served.detail_id, stored.detail_id);
    harness.close().await;
}
