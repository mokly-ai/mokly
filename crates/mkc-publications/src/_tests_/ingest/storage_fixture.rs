//! Stored-content failures with strict query boundaries and captured write attempts.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mkc_auth::runtime::RuntimeMock;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::PublicationId;
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::{BlobsMock, PublicationFile};
use mkc_store_interface::publication::{PublicationFailure, PublicationState, PublicationsMock};
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::ingest::PublicationIngest;
use crate::policy::AccessPolicyMock;
use crate::tests::support::{PROJECT, PUBLICATION, now, project, publication, token};
use crate::transaction::{QueryWork, TransactionsMock};

use super::writing;

/// A different publication ready for the upload's identity.
pub(super) const WINNER: PublicationId = PublicationId(Uuid::from_u128(77));

/// One required completion storage outcome.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Scenario {
    /// A listed detail object is gone while the upload is still live.
    MissingDetail,
    /// Reading a detail object fails.
    DetailRead,
    /// A detail's bytes differ from its declared size.
    DetailSize,
    /// The index's bytes differ from its declared size.
    IndexSize,
    /// Listing the upload's file references fails.
    ReferenceList,
    /// Another request supersedes the upload before missing content is resolved.
    ConcurrentWinner,
}

/// Strict collaborators allow final-state reads but no publication or cleanup writes.
pub(super) struct Fixture {
    /// The real completion entry point with injected collaborators.
    pub(super) ingest: PublicationIngest,
    /// Write transactions requested during completion.
    pub(super) writes: Arc<AtomicUsize>,
    _queries: Unimock,
    _files: Unimock,
    _runtime: Unimock,
    _policy: Unimock,
}

impl Fixture {
    /// Prepare one storage failure without disk, database, or clock access.
    pub(super) fn new(scenario: Scenario) -> Self {
        let deferred = matches!(
            scenario,
            Scenario::MissingDetail | Scenario::ConcurrentWinner
        );
        let index =
            include_bytes!("../../../../mkc-mokly-contract/fixtures/catalogue-v9.json").to_vec();
        let details: Value = serde_json::from_slice(include_bytes!(
            "../../../../../docs/protocol/fixtures/entry-details-v4.json"
        ))
        .unwrap();
        let detail = serde_json::to_vec(&details["current"]["components/action"]).unwrap();
        let mut index_file = reference(INDEX_PATH, &index);
        let mut detail_file = reference("mokly-viewer/entries/components/action.json", &detail);
        if scenario == Scenario::IndexSize {
            index_file.size += 1;
        }
        if scenario == Scenario::DetailSize {
            detail_file.size += 1;
        }
        let mut attempt = publication();
        attempt.state = PublicationState::Validating;
        attempt.changes = None;
        let publication_reads = AtomicUsize::new(0);
        let identity_reads = AtomicUsize::new(0);
        let reads = (
            PublicationsMock::publication
                .each_call(matching!(&PUBLICATION))
                .answers_arc(Arc::new(move |_, _| {
                    let final_read = publication_reads.fetch_add(1, Ordering::SeqCst) > 0;
                    let mut row = attempt.clone();
                    if final_read && scenario == Scenario::ConcurrentWinner {
                        row.state = PublicationState::Failed;
                        row.failure = Some(PublicationFailure::Superseded);
                    }
                    Ok(Some(row))
                }))
                .n_times(if deferred { 2 } else { 1 }),
            PublicationsMock::publication_by_identity
                .each_call(matching!(&PROJECT, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    let final_read = identity_reads.fetch_add(1, Ordering::SeqCst) > 0;
                    Ok(
                        (final_read && scenario == Scenario::ConcurrentWinner).then(|| {
                            let mut winner = publication();
                            winner.id = WINNER;
                            winner
                        }),
                    )
                }))
                .n_times(if deferred { 2 } else { 1 }),
            BlobsMock::pending_publication_blobs
                .some_call(matching!(&PUBLICATION))
                .returns(Ok(vec![])),
            BlobsMock::publication_file
                .some_call(matching!((_, path) if *path == INDEX_PATH))
                .returns(Ok(Some(index_file.clone()))),
        );
        let queries = match scenario {
            Scenario::IndexSize => Unimock::new(reads),
            Scenario::ReferenceList => Unimock::new((
                reads,
                BlobsMock::publication_files
                    .some_call(matching!(&PUBLICATION))
                    .returns(Err(mkc_store_interface::error::Error::internal(
                        Error::Unavailable,
                    ))),
            )),
            _ => Unimock::new((
                reads,
                BlobsMock::publication_files
                    .some_call(matching!(&PUBLICATION))
                    .returns(Ok(vec![index_file.clone(), detail_file.clone()])),
            )),
        };
        let query_calls = queries.clone();
        let writes = Arc::new(AtomicUsize::new(0));
        let observed_writes = writes.clone();
        let transactions = Unimock::new(
            TransactionsMock::run
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, read_only, work: &mut QueryWork<'_>| {
                    if !read_only {
                        observed_writes.fetch_add(1, Ordering::SeqCst);
                    }
                    work(&mut query_calls.clone())
                })),
        );
        let files = Unimock::new(
            FileStoreMock::get
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, key| {
                    if key == &index_file.key {
                        return Ok(Some(index.clone()));
                    }
                    assert_eq!(key, &detail_file.key);
                    match scenario {
                        Scenario::MissingDetail | Scenario::ConcurrentWinner => Ok(None),
                        Scenario::DetailRead => Err(
                            mkc_file_store_interface::error::Error::internal(Error::Unavailable),
                        ),
                        _ => Ok(Some(detail.clone())),
                    }
                }))
                .n_times(
                    if matches!(scenario, Scenario::IndexSize | Scenario::ReferenceList) {
                        1
                    } else {
                        2
                    },
                ),
        );
        let clock = RuntimeMock::now.each_call(matching!()).returns(now());
        let runtime = if deferred {
            Unimock::new((
                clock,
                RuntimeMock::id
                    .each_call(matching!())
                    .returns(PUBLICATION.0),
            ))
        } else {
            Unimock::new(clock)
        };
        let policy = if deferred {
            Unimock::new(
                AccessPolicyMock::token
                    .some_call(matching!(_, &PROJECT, _))
                    .answers(&|_, _, _, _| Ok((project(), token()))),
            )
        } else {
            Unimock::new(())
        };
        Self {
            ingest: PublicationIngest {
                transactions: Arc::new(transactions),
                runtime: Arc::new(runtime.clone()),
                files: Arc::new(files.clone()),
                policy: Arc::new(policy.clone()),
                ..writing(Unimock::new(()))
            },
            writes,
            _queries: queries,
            _files: files,
            _runtime: runtime,
            _policy: policy,
        }
    }
}

fn reference(path: &str, bytes: &[u8]) -> PublicationFile {
    PublicationFile {
        publication_id: PUBLICATION,
        project_id: PROJECT,
        path: path.into(),
        key: BlobKey {
            hash: BlobHash::digest(bytes),
            incarnation: Uuid::from_u128(100),
        },
        content_type: "application/json".into(),
        size: bytes.len() as i64,
    }
}
