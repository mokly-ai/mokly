//! Completion persists counts and comparison selections from the mandatory stored index.

use std::sync::Arc;

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::{CatalogueIndex, INDEX_PATH};
use mkc_mokly_contract::limits::Limits;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::publication::{PublicationState, PublicationsMock};
use mkc_store_interface::publication_changes::{Changes, Counts};
use mkc_store_interface::publication_event::PublicationEventsMock;
use mkc_store_interface::publication_screens::{PublicationScreensMock, Scheme, Viewport};
use mkc_store_interface::token::TokensMock;
use serde_json::{Value, json};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::ingest::Ingest;
use crate::tests::support::{PROJECT, PUBLICATION, publication};

use super::{authorization, service_with_files};

#[test]
fn stored_index_counts_and_comparison_screen_selections_are_persisted() {
    let mut unavailable: Value = serde_json::from_slice(include_bytes!(
        "../../../../mkc-mokly-contract/fixtures/index-v9.json"
    ))
    .unwrap();
    unavailable.as_object_mut().unwrap().remove("baseCommit");
    unavailable["comparisonUrl"] = Value::Null;
    unavailable["changesStatus"] = json!("unavailable");
    unavailable["removedEntries"] = json!([]);
    for kind in ["components", "documents", "pages", "screens", "useCases"] {
        for record in unavailable[kind].as_array_mut().unwrap() {
            record["changes"] = json!({"status": "unavailable"});
            record.as_object_mut().unwrap().remove("previousPath");
            if record.get("comparison").is_some() {
                record["comparison"] = json!({"status": "unavailable"});
            }
            if let Some(views) = record.get_mut("views").and_then(Value::as_array_mut) {
                for view in views {
                    view["comparison"] = json!({"status": "unavailable"});
                }
            }
        }
    }
    let counts = Changes::Available(Counts {
        changed: 7,
        added: 0,
        removed: 0,
    });
    for (bytes, expected, expected_views) in [
        (
            include_bytes!("../../../../mkc-mokly-contract/fixtures/index-v9.json").to_vec(),
            counts,
            vec![
                ("finish", Viewport::Desktop, Scheme::Light),
                ("finish", Viewport::Mobile, Scheme::Light),
                ("start", Viewport::Desktop, Scheme::Light),
                ("start", Viewport::Mobile, Scheme::Light),
            ],
        ),
        (
            serde_json::to_vec(&unavailable).unwrap(),
            Changes::NoComparison,
            vec![],
        ),
    ] {
        let index = CatalogueIndex::parse(&bytes, Limits::default()).unwrap();
        let mut attempt = publication();
        attempt.state = PublicationState::Validating;
        attempt.changes = None;
        let metadata = attempt.metadata.as_mut().unwrap();
        metadata.base_ref = index.base_commit().and(index.base()).map(str::to_owned);
        metadata.base_sha = index.base_commit().map(str::to_owned);
        let reference = PublicationFile {
            publication_id: PUBLICATION,
            project_id: PROJECT,
            path: INDEX_PATH.into(),
            key: BlobKey {
                hash: BlobHash::digest(&bytes),
                incarnation: Uuid::from_u128(55),
            },
            content_type: "application/json".into(),
            size: bytes.len() as i64,
        };
        let queries = Unimock::new((
            PublicationsMock::publication
                .each_call(matching!(&PUBLICATION))
                .answers_arc(Arc::new(move |_, _| Ok(Some(attempt.clone()))))
                .n_times(2),
            PublicationsMock::publication_by_identity
                .each_call(matching!(_, _, _))
                .answers(&|_, _, _, _| Ok(None))
                .n_times(2),
            BlobsMock::pending_publication_blobs
                .each_call(matching!(&PUBLICATION))
                .answers(&|_, _| Ok(vec![]))
                .n_times(2),
            BlobsMock::publication_file
                .next_call(matching!((_, path) if *path == INDEX_PATH))
                .returns(Ok(Some(reference.clone()))),
            BlobsMock::publication_files
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(vec![reference])),
            PublicationScreensMock::insert_publication_screen_views
                .next_call(matching!(&PUBLICATION, _))
                .answers_arc(Arc::new(move |_, _, views| {
                    assert_eq!(
                        views
                            .iter()
                            .map(|view| (view.screen_path.as_str(), view.viewport, view.scheme))
                            .collect::<Vec<_>>(),
                        expected_views
                    );
                    Ok(())
                })),
            PublicationsMock::ready_publication
                .next_call(matching!(&PUBLICATION, _))
                .answers_arc(Arc::new(move |_, _, changes| {
                    assert_eq!(changes, expected);
                    Ok(true)
                })),
            PublicationsMock::insert_branch_alias
                .next_call(matching!(_, _, _))
                .returns(Ok(())),
            PublicationEventsMock::insert_publication_event
                .next_call(matching!(_))
                .returns(Ok(())),
            TokensMock::save_token
                .next_call(matching!(_))
                .returns(Ok(())),
        ));
        let ingest = service_with_files(
            queries,
            Unimock::new(()),
            Unimock::new(()),
            Unimock::new(
                FileStoreMock::get
                    .next_call(matching!(_))
                    .returns(Ok(Some(bytes))),
            ),
        );
        let result = ingest.complete(authorization(), PUBLICATION);
        assert!(result.is_ok(), "stored index completion: {result:?}");
        let publication = result.unwrap().publication;
        assert_eq!(publication.state, PublicationState::Ready);
        assert_eq!(publication.changes, Some(expected));
    }
}
