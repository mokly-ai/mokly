//! A stored index the pinned reader refuses is a permanent delivery failure.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::project::ProjectsMock;
use mkc_store_interface::publication::PublicationsMock;
use mkc_store_interface::publication_event::{
    EventKind, PendingEvent, PublicationEvent, PublicationEventsMock,
};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::check_worker::{ChecksWorker, PublicationChecks};
use crate::stored_index::BoundedStoredIndexReader;

use super::support::{
    PROJECT, PUBLICATION, claim, clock, locations, now, organization_query, project, publication,
    transactions,
};

#[test]
fn a_index_from_an_earlier_schema_spends_the_permanent_budget() {
    for stored in [
        br#"{"schemaVersion":4}"#.as_slice(),
        br#"{"schemaVersion":5}"#.as_slice(),
        b"not json",
    ] {
        let mut value = publication();
        let metadata = value.metadata.as_mut().unwrap();
        metadata.base_ref = Some("HEAD~1".into());
        metadata.base_sha = Some("c".repeat(40));
        let queries = Unimock::new((
            claim(0, 0),
            PublicationEventsMock::pending_publication_events
                .next_call(matching!(_, 100, None))
                .returns(Ok(vec![PendingEvent {
                    attempts: 0,
                    permanent_failures: 0,
                    event: PublicationEvent {
                        id: Uuid::from_u128(7),
                        publication_id: PUBLICATION,
                        kind: EventKind::Ready,
                        created_at: now(),
                    },
                }])),
            PublicationsMock::publication
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(Some(value))),
            ProjectsMock::project
                .next_call(matching!(&PROJECT))
                .returns(Ok(Some(project()))),
            organization_query(),
            BlobsMock::publication_file
                .next_call(matching!(_, _))
                .returns(Ok(Some(PublicationFile {
                    publication_id: PUBLICATION,
                    project_id: PROJECT,
                    path: INDEX_PATH.into(),
                    key: BlobKey {
                        hash: BlobHash::digest(stored),
                        incarnation: Uuid::from_u128(10),
                    },
                    content_type: "application/json".into(),
                    size: stored.len() as i64,
                }))),
            PublicationEventsMock::retry_publication_event
                .next_call(matching!(_, 1, 1, _, &None))
                .returns(Ok(true)),
        ));
        let files = Unimock::new(
            FileStoreMock::get
                .next_call(matching!(_))
                .returns(Ok(Some(stored.to_vec()))),
        );
        let worker = PublicationChecks {
            transactions: transactions(queries),
            files: Arc::new(BoundedStoredIndexReader::new(Arc::new(files))),
            github: Arc::new(Unimock::new(())),
            runtime: clock(),
            locations: locations(),
        };
        assert_eq!(worker.run_batch(None).unwrap(), 0);
    }
}
