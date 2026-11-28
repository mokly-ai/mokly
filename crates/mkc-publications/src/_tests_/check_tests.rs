//! Durable delivery, stable check identity and rerequest authorization.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_github_interface::check::{CheckRunsMock, Conclusion};
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
use crate::error::Error;
use crate::stored_index::BoundedStoredIndexReader;

use super::check_fixture;
use super::support::{
    PROJECT, PUBLICATION, bundle, claim, clock, locations, now, organization_query, project,
    publication, runtime, transactions,
};

fn event() -> PendingEvent {
    PendingEvent {
        attempts: 0,
        permanent_failures: 0,
        event: PublicationEvent {
            id: Uuid::from_u128(7),
            publication_id: PUBLICATION,
            kind: EventKind::Ready,
            created_at: now(),
        },
    }
}

#[test]
fn comparisons_succeed_and_current_only_is_neutral() {
    for case in ["comparison", "disabled", "unavailable"] {
        let mut value = publication();
        let bundle = bundle();
        let path = INDEX_PATH.to_owned();
        let bytes = if case == "comparison" {
            bundle.index_bytes().to_vec()
        } else {
            serde_json::to_vec(&super::index_fixture::current_document(case)).unwrap()
        };
        if case == "comparison" {
            let metadata = value.metadata.as_mut().unwrap();
            metadata.base_ref = bundle.manifest().base_ref.clone();
            metadata.base_sha = bundle.manifest().base_sha.clone();
        }
        let common = (
            claim(0, 0),
            PublicationEventsMock::pending_publication_events
                .some_call(matching!(_, 100, None))
                .returns(Ok(vec![event()])),
            PublicationsMock::publication
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(Some(value))),
            ProjectsMock::project
                .some_call(matching!(&PROJECT))
                .returns(Ok(Some(project()))),
            organization_query(),
            PublicationEventsMock::deliver_publication_event
                .some_call(matching!(_, 1, _))
                .returns(Ok(true)),
        );
        let queries = Unimock::new((
            common,
            BlobsMock::publication_file
                .some_call(matching!((_, requested) if *requested == INDEX_PATH))
                .returns(Ok(Some(PublicationFile {
                    publication_id: PUBLICATION,
                    project_id: PROJECT,
                    path,
                    key: BlobKey {
                        hash: BlobHash::digest(&bytes),
                        incarnation: Uuid::from_u128(10),
                    },
                    content_type: "application/json".into(),
                    size: bytes.len() as i64,
                }))),
        ));
        let github = {
            Unimock::new(
                CheckRunsMock::upsert
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, check| {
                        assert_eq!(check.name, "Mokly");
                        assert_eq!(
                            check.external_id,
                            format!("mokly-publication:{PUBLICATION}")
                        );
                        assert_eq!(check.repository, "mokly-ai/mokly-cloud");
                        assert_eq!(
                            check.conclusion,
                            Some(match case {
                                "comparison" => Conclusion::Success,
                                _ => Conclusion::Neutral,
                            })
                        );
                        assert_eq!(
                            check.summary.contains("[View Changes]"),
                            case == "comparison"
                        );
                        assert_eq!(
                            check.summary == "Catalogue published.",
                            case != "comparison"
                        );
                        assert!(check.details_url.ends_with("?view=changes"));
                        Ok(())
                    })),
            )
        };
        let reads = Arc::new(AtomicUsize::new(0));
        let observed = reads.clone();
        let files = Unimock::new(
            FileStoreMock::get
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    observed.fetch_add(1, Ordering::SeqCst);
                    Ok(Some(bytes.clone()))
                })),
        );
        let worker = PublicationChecks {
            transactions: transactions(queries),
            files: Arc::new(BoundedStoredIndexReader::new(Arc::new(files))),
            github: Arc::new(github),
            runtime: clock(),
            locations: locations(),
        };
        assert_eq!(worker.run_batch(None).unwrap(), 1);
        assert_eq!(reads.load(Ordering::SeqCst), 1);
    }
}

#[test]
fn provider_failure_keeps_event_pending_and_retry_uses_the_same_check() {
    let queries = Unimock::new((
        claim(0, 0),
        PublicationEventsMock::pending_publication_events
            .each_call(matching!(_, _, None))
            .answers(&|_, _, _, _| Ok(vec![event()]))
            .n_times(2),
        PublicationsMock::publication
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(publication())))
            .n_times(2),
        ProjectsMock::project
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Some(project())))
            .n_times(2),
        organization_query(),
        check_fixture::reference(PUBLICATION, PROJECT, 2),
        PublicationEventsMock::retry_publication_event
            .next_call(matching!(_, 1, 0, _, &None))
            .returns(Ok(true)),
        PublicationEventsMock::deliver_publication_event
            .next_call(matching!(_, 1, _))
            .returns(Ok(true)),
    ));
    let github = Unimock::new((
        CheckRunsMock::upsert.next_call(matching!(_)).returns(Err(
            mkc_github_interface::check::Error::internal(Error::Unavailable),
        )),
        CheckRunsMock::upsert
            .next_call(matching!(_))
            .answers(&|_, check| {
                assert_eq!(
                    check.external_id,
                    format!("mokly-publication:{PUBLICATION}")
                );
                Ok(())
            }),
    ));
    let worker = PublicationChecks {
        transactions: transactions(queries),
        files: check_fixture::files(2),
        github: Arc::new(github),
        runtime: clock(),
        locations: locations(),
    };
    assert_eq!(worker.run_batch(None).unwrap(), 0);
    assert_eq!(worker.run_batch(None).unwrap(), 1);
}

#[test]
fn rerequests_require_original_repository_and_head_and_never_rebuild() {
    for authorized in [true, false] {
        let common = (
            PublicationsMock::publication
                .next_call(matching!(&PUBLICATION))
                .returns(Ok(Some(publication()))),
            ProjectsMock::project
                .next_call(matching!(&PROJECT))
                .returns(Ok(Some(project()))),
        );
        let queries = if authorized {
            Unimock::new((
                common,
                PublicationEventsMock::insert_publication_event
                    .next_call(matching!((event,) if event.kind == EventKind::Rerequest))
                    .returns(Ok(())),
            ))
        } else {
            Unimock::new(common)
        };
        let worker = PublicationChecks {
            transactions: transactions(queries),
            files: Arc::new(Unimock::new(())),
            github: Arc::new(Unimock::new(())),
            runtime: runtime(),
            locations: locations(),
        };
        let result = worker.rerequest(
            PUBLICATION,
            if authorized {
                "Mokly-AI/Mokly-Cloud"
            } else {
                "elsewhere/repository"
            },
            &"b".repeat(40),
        );
        if authorized {
            assert!(result.is_ok());
        } else {
            assert!(matches!(result, Err(Error::Forbidden)));
        }
    }
}
