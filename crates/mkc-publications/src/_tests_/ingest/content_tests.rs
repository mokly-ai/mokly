//! Completion validates durable detail references before any ready transaction.

use std::sync::{Arc, Mutex};

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::error::Rejection;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::publication::{PublicationFailure, PublicationState, PublicationsMock};
use mkc_store_interface::publication_event::{EventKind, PublicationEventsMock};
use serde_json::{Value, json};
use unimock::{Clause, MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::ingest::{Ingest, PublicationIngest};
use crate::tests::support::{PROJECT, PUBLICATION, publication, runtime};
use crate::transaction::{QueryWork, TransactionsMock};

use super::{authorization, writing};

fn index() -> Value {
    serde_json::from_slice(include_bytes!(
        "../../../../mkc-mokly-contract/fixtures/catalogue-v9.json"
    ))
    .unwrap()
}

fn detail(side: &str) -> Value {
    let fixture: Value = serde_json::from_slice(include_bytes!(
        "../../../../../docs/protocol/fixtures/entry-details-v4.json"
    ))
    .unwrap();
    fixture[side]
        .as_object()
        .unwrap()
        .values()
        .next()
        .unwrap()
        .clone()
}

fn reference(path: String, bytes: &[u8]) -> PublicationFile {
    PublicationFile {
        publication_id: PUBLICATION,
        project_id: PROJECT,
        path,
        key: BlobKey {
            hash: BlobHash::digest(bytes),
            incarnation: Uuid::from_u128(100),
        },
        content_type: "application/json".into(),
        size: bytes.len() as i64,
    }
}

pub(super) fn failure_cleanup(events: Arc<Mutex<Vec<EventKind>>>) -> impl Clause {
    (
        PublicationsMock::fail_publication
            .some_call(matching!(&PUBLICATION, PublicationFailure::InvalidBundle))
            .returns(Ok(true)),
        BlobsMock::delete_publication_files
            .some_call(matching!(&PUBLICATION))
            .returns(Ok(())),
        PublicationEventsMock::insert_publication_event
            .some_call(matching!((event) if event.publication_id == PUBLICATION && event.kind == EventKind::Failed))
            .answers_arc(Arc::new(move |_, event| {
                events.lock().unwrap().push(event.kind);
                Ok(())
            })),
    )
}

#[test]
fn completion_rechecks_every_stored_detail_before_publishing() {
    let mut reused_index = index();
    reused_index["revision"] = json!(1);
    let mut unlisted = detail("current");
    unlisted["entry"]["path"] = json!("extra/unlisted");
    let mut removed = detail("removed");
    removed["sourceGraph"] = json!({});
    let removed_path = format!(
        "{}entries/extra.json",
        index()["comparisonUrl"].as_str().unwrap()
    );
    for (name, index, path, detail, reason) in [
        (
            "reused",
            reused_index,
            "mokly-viewer/entries/components/action.json".into(),
            detail("current"),
            Rejection::Detail,
        ),
        (
            "unlisted",
            index(),
            "mokly-viewer/entries/extra/unlisted.json".into(),
            unlisted,
            Rejection::Detail,
        ),
        ("removed", index(), removed_path, removed, Rejection::Detail),
    ] {
        let index = serde_json::to_vec(&index).unwrap();
        let detail = serde_json::to_vec(&detail).unwrap();
        let index_file = reference(INDEX_PATH.into(), &index);
        let detail_file = reference(path, &detail);
        let listed = vec![index_file.clone(), detail_file.clone()];
        let mut attempt = publication();
        attempt.state = PublicationState::Validating;
        let events = Arc::new(Mutex::new(Vec::new()));
        let queries = Unimock::new((
            PublicationsMock::publication
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(Some(attempt))),
            PublicationsMock::publication_by_identity
                .some_call(matching!(_, _, _))
                .returns(Ok(None)),
            BlobsMock::pending_publication_blobs
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(vec![])),
            BlobsMock::publication_file
                .some_call(matching!((_, path) if *path == INDEX_PATH))
                .returns(Ok(Some(index_file.clone()))),
            BlobsMock::publication_files
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(listed)),
            failure_cleanup(events.clone()),
        ));
        let query_calls = queries.clone();
        let transactions = Arc::new(Unimock::new(
            TransactionsMock::run
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, work: &mut QueryWork<'_>| {
                    work(&mut query_calls.clone())
                })),
        ));
        let files = Unimock::new(
            FileStoreMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    Ok(Some(if key == &index_file.key {
                        index.clone()
                    } else if key == &detail_file.key {
                        detail.clone()
                    } else {
                        panic!("unexpected stored content")
                    }))
                })),
        );
        let ingest = PublicationIngest {
            transactions,
            runtime: runtime(),
            files: Arc::new(files),
            ..writing(Unimock::new(()))
        };
        assert!(
            matches!(ingest.complete(authorization(), PUBLICATION), Err(Error::InvalidBundle { reason: actual }) if actual == reason),
            "{name}"
        );
        assert_eq!(*events.lock().unwrap(), [EventKind::Failed], "{name}");
    }
}
