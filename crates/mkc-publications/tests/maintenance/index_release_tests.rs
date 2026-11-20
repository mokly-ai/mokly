//! A request that closes an upload before its completion reads the stored index
//! changes that completion's answer to the closed state, never to a failure.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use mkc_auth::runtime::{SystemRuntime, hash};
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_publications::error::{Error, Result};
use mkc_publications::ingest::{Ingest, Ingested, PublicationIngest};
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_publications::transaction::{QueryWork, StoreTransactions, Transactions};
use mkc_store_interface::publication::{Publication, PublicationFailure, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::{Callback, Store};
use mkc_store_interface::token::Token;
use unimock::Unimock;
use uuid::Uuid;

use super::fixtures::{blob, file, project, publication, store};

/// How the other request closed the upload.
#[derive(Clone, Copy)]
enum Close {
    /// Another completion of the upload found a different upload ready for
    /// the same commit and closed this one as superseded.
    Superseded,
    /// Retention closed the upload at its deadline.
    Expired,
}

/// Commits the other request's close just before the completion's third
/// read-only transaction (resolve, pending check, stored index read).
struct CloseBeforeIndex {
    inner: StoreTransactions,
    reads: AtomicUsize,
    close: Mutex<Option<Box<dyn FnOnce() + Send>>>,
}

impl Transactions for CloseBeforeIndex {
    fn run(&self, read_only: bool, work: &mut QueryWork<'_>) -> Result<()> {
        if read_only
            && self.reads.fetch_add(1, Ordering::SeqCst) == 2
            && let Some(close) = self.close.lock().unwrap().take()
        {
            close();
        }
        self.inner.run(read_only, work)
    }
}

/// Complete an unfinished upload whose stored index another request releases.
fn complete_after(
    store: &Arc<dyn Store>,
    close: Close,
) -> (Result<Ingested>, Publication, Publication, usize) {
    let project = project(store.as_ref());
    let bearer = format!("mkc_{}", "b".repeat(64));
    let token = Token {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        name: "Index release".into(),
        prefix: "mkc_bbbb".into(),
        token_hash: hash(&bearer),
        created_at: Utc::now(),
        last_used_at: None,
        revoked_at: None,
    };
    let other = publication(&project, PublicationState::Validating, 0, "feature");
    let mut upload = Publication {
        id: Uuid::now_v7().into(),
        ..other.clone()
    };
    if let Some(metadata) = &mut upload.metadata {
        metadata.base_ref = Some("main".into());
        metadata.base_sha = Some("c".repeat(40));
    }
    let stored = blob(project.id, b"{\"stored\":\"index\"}");
    let mut index = file(project.id, upload.id, stored.key.clone());
    index.path = INDEX_PATH.into();
    index.size = stored.size;
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_token(&token)?;
            queries.insert_publication(&upload)?;
            queries.insert_publication(&other)?;
            queries.insert_blob(&stored)?;
            assert!(queries.mark_blob_stored(&stored.key)?);
            queries.insert_publication_file(&index)
        }))
        .unwrap();
    let plain = PublicationIngest {
        transactions: Arc::new(StoreTransactions {
            store: store.clone(),
        }),
        runtime: Arc::new(SystemRuntime),
        policy: Arc::new(DatabaseAccessPolicy),
        validator: Arc::new(Unimock::new(())),
        writer: Arc::new(Unimock::new(())),
        files: Arc::new(Unimock::new(())),
    };
    let authorization = plain.authorize(project.id, &bearer).unwrap();
    let closing = store.clone();
    let (closed, replacement) = (upload.id, other.id);
    let racing = PublicationIngest {
        transactions: Arc::new(CloseBeforeIndex {
            inner: StoreTransactions {
                store: store.clone(),
            },
            reads: AtomicUsize::new(0),
            close: Mutex::new(Some(Box::new(move || {
                closing
                    .transaction(&mut Callback(&mut |queries| {
                        let failure = match close {
                            Close::Superseded => {
                                assert!(
                                    queries
                                        .ready_publication(replacement, Changes::NoComparison)?
                                );
                                PublicationFailure::Superseded
                            }
                            Close::Expired => PublicationFailure::Expired,
                        };
                        assert!(queries.fail_publication(closed, failure)?);
                        queries.delete_publication_files(closed)
                    }))
                    .unwrap();
            }))),
        }),
        ..plain
    };
    let result = racing.complete(authorization, upload.id);
    let mut rows = (None, None, 0);
    store
        .transaction(&mut Callback(&mut |queries| {
            rows = (
                queries.publication(upload.id)?,
                queries.publication(other.id)?,
                queries.publication_files(upload.id)?.len(),
            );
            Ok(())
        }))
        .unwrap();
    (result, rows.0.unwrap(), rows.1.unwrap(), rows.2)
}

#[test]
fn a_superseded_upload_answers_with_the_winner_after_its_index_is_released() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let (result, upload, other, files) = complete_after(&store, Close::Superseded);
    let done = result.unwrap();
    assert_eq!((done.publication.id, done.replay), (other.id, true));
    assert_eq!(other.state, PublicationState::Ready);
    assert_eq!(
        (upload.state, upload.failure, files),
        (
            PublicationState::Failed,
            Some(PublicationFailure::Superseded),
            0
        )
    );
}

#[test]
fn an_upload_closed_at_its_deadline_answers_expired_after_its_index_is_released() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let (result, upload, _, files) = complete_after(&store, Close::Expired);
    assert!(matches!(result, Err(Error::Expired)));
    assert_eq!(
        (upload.state, upload.failure, files),
        (
            PublicationState::Failed,
            Some(PublicationFailure::Expired),
            0
        )
    );
}
