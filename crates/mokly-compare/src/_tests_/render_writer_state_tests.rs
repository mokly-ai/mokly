//! Delayed busy output cannot supersede a complete idle snapshot from the writer.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::document_store::{DocumentStore, OfferOutcome, ReadOutcome, StoreKey, StoreStats};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::render_identity::NativeIdentityMock;
use crate::render_pending::StoreObserverMock;
use crate::render_store::{DocumentBackendMock, WriteOutcome};
use crate::render_writer::{DocumentWriter, WriterLimits};
use crate::render_writer_control::Startup;

struct Release(Vec<mpsc::Sender<()>>);
impl Drop for Release {
    fn drop(&mut self) {
        for release in &self.0 {
            let _ = release.send(());
        }
    }
}

#[test]
fn delayed_contention_records_keep_complete_idle_state_at_the_highest_sequence() {
    let cache: Arc<dyn RenderCache> =
        Arc::new(MemoryCache::new(256 * 1024 * 1024, 128 * 1024 * 1024));
    cache.insert(
        NodeKey("document".into()),
        Arc::new(Artifact {
            bytes: b"complete".to_vec(),
            content_type: "text/html".into(),
            fragment: None,
            document: Some(Composed {
                tree: vec![],
                usage: CatalogueUsage::Pending,
                warnings: vec![],
                resources: vec![],
                components: vec![],
                links: vec![],
            }),
        }),
    );
    let (active, active_seen) = mpsc::channel();
    let (release_active, active_released) = mpsc::channel();
    let active_released = Mutex::new(active_released);
    let (busy, busy_seen) = mpsc::channel();
    let (release_busy, busy_released) = mpsc::channel();
    let busy_released = Mutex::new(busy_released);
    let (completed, completion_seen) = mpsc::channel();
    let (initializing, initialization_seen) = mpsc::channel();
    let (release_initialization, initialization_released) = mpsc::channel();
    let initialization_released = Mutex::new(initialization_released);
    let identity = Arc::new(Unimock::new((
        NativeIdentityMock::prepare
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                initializing.send(()).unwrap();
                initialization_released.lock().unwrap().recv().unwrap();
            })),
        NativeIdentityMock::current
            .some_call(matching!())
            .returns(Some([7; 32])),
        NativeIdentityMock::cancelled
            .some_call(matching!())
            .returns(false),
    )));
    let output = Arc::new(Mutex::new(Vec::<StoreStats>::new()));
    let recorded = output.clone();
    let observer = Arc::new(Unimock::new(
        StoreObserverMock::state
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, stats| {
                if stats.active == 1 && stats.drops == 0 {
                    active.send(()).unwrap();
                    active_released.lock().unwrap().recv().unwrap();
                }
                if stats.active == 1 && stats.drops == 1 && stats.writes == 0 {
                    busy.send(()).unwrap();
                    busy_released.lock().unwrap().recv().unwrap();
                }
                recorded.lock().unwrap().push(stats);
                if stats.writes == 1 {
                    completed.send(()).unwrap();
                }
            })),
    ));
    let backend = Arc::new(Unimock::new((
        DocumentBackendMock::version
            .each_call(matching!())
            .returns("current".to_owned()),
        DocumentBackendMock::initialize
            .some_call(matching!())
            .returns(ReadOutcome::Miss),
        DocumentBackendMock::save
            .some_call(matching!(_))
            .answers(&|_, documents| WriteOutcome::Written(documents.documents())),
    )));
    let store = Arc::new(DocumentWriter::prepared(
        backend,
        cache,
        WriterLimits::default(),
        observer,
        Startup {
            identity,
            context: "build".into(),
        },
    ));
    let releases = Release(vec![release_active, release_busy, release_initialization]);
    initialization_seen.recv().unwrap();
    assert_eq!(
        store.offer(
            StoreKey::new(&NodeKey("document".into()), "build"),
            NodeKey("document".into())
        ),
        OfferOutcome::Queued
    );
    releases.0[2].send(()).unwrap();
    store.resume();
    active_seen.recv().unwrap();
    let offering = store.clone();
    let contention = thread::spawn(move || {
        offering.offer(
            StoreKey::new(&NodeKey("drop".into()), "build"),
            NodeKey("drop".into()),
        )
    });
    busy_seen.recv().unwrap();
    releases.0[0].send(()).unwrap();
    completion_seen.recv().unwrap();
    let complete = store.stats();
    assert_eq!(
        (
            complete.queued,
            complete.active,
            complete.writes,
            complete.drops
        ),
        (0, 0, 1, 1)
    );
    releases.0[1].send(()).unwrap();
    assert_eq!(contention.join().unwrap(), OfferOutcome::Dropped);
    let records = output.lock().unwrap().clone();
    let highest = records.iter().max_by_key(|stats| stats.sequence).unwrap();
    assert_eq!(
        *highest, complete,
        "the highest sequence must describe the newest complete state"
    );
    assert_eq!(
        records.last().unwrap().active,
        1,
        "the delayed older callback must arrive after completion"
    );
    assert_eq!(
        records
            .iter()
            .filter(|stats| stats.active == 1 && stats.drops == 1)
            .count(),
        1,
        "a contended offer publishes its own complete drop record"
    );
    store.shutdown();
}
