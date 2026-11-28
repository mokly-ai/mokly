//! Repeated completions of one upload publish it once and never release its files.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use std::thread;

use chrono::{Duration, Utc};
use mkc_auth::runtime::{SystemRuntime, hash};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_publications::error::Result;
use mkc_publications::ingest::{Ingest, PublicationIngest};
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_publications::stored_index::BoundedStoredIndexReader;
use mkc_publications::transaction::{QueryWork, StoreTransactions, Transactions};
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_event::EventKind;
use mkc_store_interface::store::Callback;
use mkc_store_interface::token::Token;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::fixtures::{blob, current_index, file, project, publication, store};

/// Holds both requests until each has resolved its upload as unfinished, then
/// runs their ready transactions one after the other: the overlap a resent
/// completion creates while the first one is still being served.
struct Overlap {
    inner: StoreTransactions,
    barrier: Barrier,
    arrivals: AtomicUsize,
    serial: Mutex<()>,
}

impl Transactions for Overlap {
    fn run(&self, read_only: bool, work: &mut QueryWork<'_>) -> Result<()> {
        if read_only {
            return self.inner.run(true, work);
        }
        if self.arrivals.fetch_add(1, Ordering::SeqCst) < 2 {
            self.barrier.wait();
        }
        let _serial = self.serial.lock().unwrap();
        self.inner.run(false, work)
    }
}

#[test]
fn overlapping_completions_of_one_upload_publish_it_once_and_keep_its_files() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let bearer = format!("mkc_{}", "a".repeat(64));
    let token = Token {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        name: "Completion race".into(),
        prefix: "mkc_aaaa".into(),
        token_hash: hash(&bearer),
        created_at: Utc::now(),
        last_used_at: None,
        revoked_at: None,
    };
    let upload = publication(&project, PublicationState::Validating, 0, "feature");
    let bytes = current_index();
    let stored = blob(project.id, &bytes);
    let mut index = file(project.id, upload.id, stored.key.clone());
    index.size = stored.size;
    index.path = INDEX_PATH.into();
    store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_token(&token)?;
            queries.insert_publication(&upload)?;
            queries.insert_blob(&stored)?;
            assert!(queries.mark_blob_stored(&stored.key)?);
            queries.insert_publication_file(&index)
        }))
        .unwrap();
    let files = Arc::new(Unimock::new(
        FileStoreMock::get
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(Some(bytes.clone()))))
            .n_times(2),
    ));
    let ingest = Arc::new(PublicationIngest {
        transactions: Arc::new(Overlap {
            inner: StoreTransactions {
                store: store.clone(),
            },
            barrier: Barrier::new(2),
            arrivals: AtomicUsize::new(0),
            serial: Mutex::new(()),
        }),
        runtime: Arc::new(SystemRuntime),
        policy: Arc::new(DatabaseAccessPolicy),
        validator: Arc::new(Unimock::new(())),
        writer: Arc::new(Unimock::new(())),
        files: Arc::new(BoundedStoredIndexReader::new(files)),
    });
    let requests: Vec<_> = (0..2)
        .map(|_| {
            let ingest = ingest.clone();
            let bearer = bearer.clone();
            let (project_id, upload_id) = (project.id, upload.id);
            thread::spawn(move || {
                let authorization = ingest.authorize(project_id, &bearer).unwrap();
                let done = ingest.complete(authorization, upload_id).unwrap();
                (done.publication.id, done.publication.state, done.replay)
            })
        })
        .collect();
    let outcomes: Vec<_> = requests
        .into_iter()
        .map(|request| request.join().unwrap())
        .collect();

    let mut files = 0;
    let mut state = None;
    let mut events = Vec::new();
    store
        .transaction(&mut Callback(&mut |queries| {
            files = queries.publication_files(upload.id)?.len();
            state = queries.publication(upload.id)?.map(|row| row.state);
            events = queries.pending_publication_events(
                Utc::now() + Duration::days(1),
                100,
                Some(project.id),
            )?;
            Ok(())
        }))
        .unwrap();
    assert_eq!(state, Some(PublicationState::Ready));
    assert_eq!(files, 1, "the published catalogue keeps its file list");
    let kinds: Vec<_> = events.iter().map(|pending| pending.event.kind).collect();
    assert_eq!(kinds, [EventKind::Ready], "one ready event and no failure");
    assert_eq!(
        outcomes,
        [(upload.id, PublicationState::Ready, false); 2],
        "every completion of the upload that became ready answers 201 with it"
    );
}
