//! Every publication is ordered and invalidates old queued live work.

use std::sync::Arc;

use mokly_server::publication::{PublicationWriter, Publications, SharedPublication};
use mokly_server::snapshot::{Projector, SnapshotFactory, SnapshotInput};

use super::support;

#[tokio::test]
async fn subscriptions_keep_each_revision_and_reject_invalid_replacements() {
    let harness = support::Harness::new().await;
    let shared = SharedPublication::new(harness.snapshot.clone());
    let projector: &dyn SnapshotFactory = &Projector {
        deployment_id: harness.snapshot.index.deployment_id.clone(),
        render_token: harness.snapshot.render_token.clone(),
    };
    let make = |revision| {
        projector
            .create(
                harness.generation.clone(),
                SnapshotInput {
                    documents: harness.snapshot.documents.clone(),
                    revision,
                    config_path: "mokly.config.json".into(),
                    base: None,
                    assets: Default::default(),
                },
            )
            .unwrap()
    };
    let mut subscriber = shared.subscribe();
    assert_eq!(subscriber.current.revision, 1);
    assert!(harness.snapshot.lease.valid());
    assert!(!shared.replace(make(3)));
    let second = make(2);
    assert!(shared.replace(second.clone()));
    assert!(!harness.snapshot.lease.valid());
    assert!(second.lease.valid());
    assert!(shared.replace(make(3)));
    assert!(!second.lease.valid());
    assert_eq!(subscriber.updates.recv().await.unwrap().revision, 2);
    assert_eq!(subscriber.updates.recv().await.unwrap().revision, 3);
    assert_eq!(shared.subscribe().current.revision, 3);
    let foreign = Arc::new(Projector {
        deployment_id: "f".repeat(64),
        render_token: harness.snapshot.render_token.clone(),
    });
    let invalid = foreign
        .create(
            harness.generation.clone(),
            SnapshotInput {
                documents: harness.snapshot.documents.clone(),
                revision: 4,
                config_path: "mokly.config.json".into(),
                base: None,
                assets: Default::default(),
            },
        )
        .unwrap();
    assert!(!shared.replace(invalid));
    assert_eq!(shared.current().index.revision, 3);
    harness.close().await;
}
