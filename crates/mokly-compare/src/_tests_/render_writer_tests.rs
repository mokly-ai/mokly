//! An explicitly blocked disk sink cannot block key admission or a cache read.

use std::sync::{Arc, Barrier, Mutex, mpsc};
use std::thread;

use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::document_store::{DocumentStore, EntryFault, OfferOutcome, ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::render_admission::idle_writer::offer_when_idle;
use crate::render_pending::{StoreObserverMock, StoreWarning};
use crate::render_segment_buffer::BuiltSegment;
use crate::render_store::{DocumentBackendMock, WriteOutcome};
use crate::render_writer::{DocumentWriter, WriterLimits};

struct Release(Option<Arc<Barrier>>);
impl Release {
    fn release(&mut self) {
        if let Some(barrier) = self.0.take() {
            barrier.wait();
        }
    }
}
impl Drop for Release {
    fn drop(&mut self) {
        self.release();
    }
}

#[test]
fn a_full_key_queue_returns_the_render_while_disk_publication_is_blocked() {
    let cache: Arc<dyn RenderCache> =
        Arc::new(MemoryCache::new(256 * 1024 * 1024, 128 * 1024 * 1024));
    let artifact = Arc::new(Artifact {
        bytes: b"rendered".to_vec(),
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
    });
    for key in ["a", "b", "c"] {
        cache.insert(NodeKey(key.into()), artifact.clone());
    }
    let (ready, waiting) = mpsc::channel();
    let resume = Arc::new(Barrier::new(2));
    let release = resume.clone();
    let ready = Mutex::new(Some(ready));
    let backend = Arc::new(Unimock::new((
        DocumentBackendMock::version
            .each_call(matching!())
            .returns("current".to_owned()),
        DocumentBackendMock::save
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, documents: &BuiltSegment| {
                ready.lock().unwrap().take().unwrap().send(()).unwrap();
                release.wait();
                WriteOutcome::Written(documents.documents())
            })),
    )));
    let store = Arc::new(DocumentWriter::new(
        backend,
        cache.clone(),
        WriterLimits {
            keys: 2,
            key_bytes: 4096,
            segment_bytes: 65536,
        },
    ));
    let mut release_on_failure = Release(None);
    assert_eq!(
        offer_when_idle(
            &store,
            StoreKey::new(&NodeKey("a".into()), "build"),
            NodeKey("a".into())
        ),
        OfferOutcome::Queued
    );
    waiting.recv().unwrap();
    release_on_failure.0 = Some(resume.clone());
    assert_eq!(
        store.offer(
            StoreKey::new(&NodeKey("oversized".into()), "build"),
            NodeKey("x".repeat(8192))
        ),
        OfferOutcome::Dropped
    );
    assert_eq!(
        store.offer(
            StoreKey::new(&NodeKey("b".into()), "build"),
            NodeKey("b".into())
        ),
        OfferOutcome::Queued
    );
    let render_store = store.clone();
    let rendered = thread::spawn(move || {
        let outcome = render_store.offer(
            StoreKey::new(&NodeKey("c".into()), "build"),
            NodeKey("c".into()),
        );
        (
            outcome,
            cache.get(&NodeKey("c".into())).unwrap().bytes.clone(),
        )
    });
    assert_eq!(
        rendered.join().unwrap(),
        (OfferOutcome::Dropped, b"rendered".to_vec())
    );
    assert_eq!(store.stats().active, 1);
    store.stop();
    assert_eq!(store.stats().queued, 0);
    release_on_failure.release();
    store.shutdown();
    assert_eq!(store.stats().active, 0);
    assert_eq!(store.stats().writes, 1);
    assert_eq!(store.stats().drops, 3);
    let memory = store.stats().memory;
    assert!(
        memory.segment_peak >= 163_852,
        "the fixed byte allocation must be recorded"
    );
    assert!(memory.segment_peak <= 4 * 1024 * 1024);
    assert!(
        memory.export_peak > 0,
        "a full export must report its known scratch"
    );
    assert!(memory.known_peak >= memory.segment_peak + memory.queue);
    assert_eq!(
        (
            memory.segment,
            memory.flatten,
            memory.compressed,
            memory.metadata,
            memory.stored_metadata,
            memory.codec
        ),
        (0, 0, 0, 0, 0, 0)
    );
}

#[test]
fn entry_faults_warn_each_time_and_a_store_fault_disables_later_reads_once() {
    let warnings = Arc::new(Mutex::new(Vec::new()));
    let captured = warnings.clone();
    let observer = Arc::new(Unimock::new((
        StoreObserverMock::state.each_call(matching!(_)).returns(()),
        StoreObserverMock::warning
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, warning: StoreWarning| {
                captured.lock().unwrap().push(warning)
            })),
    )));
    let backend = Arc::new(Unimock::new((
        DocumentBackendMock::load
            .next_call(matching!(_))
            .returns(ReadOutcome::Rejected(EntryFault::Foreign)),
        DocumentBackendMock::load
            .next_call(matching!(_))
            .returns(ReadOutcome::Rejected(EntryFault::Damaged)),
        DocumentBackendMock::load
            .next_call(matching!(_))
            .returns(ReadOutcome::Unavailable),
    )));
    let store = DocumentWriter::observed(
        backend,
        Arc::new(MemoryCache::new(0, 0)),
        WriterLimits::default(),
        observer,
    );
    let key = StoreKey::new(&NodeKey("a".into()), "build");
    assert_eq!(store.stats().misses, 0);
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Foreign)
    ));
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Damaged)
    ));
    assert!(matches!(store.load(&key), ReadOutcome::Unavailable));
    assert!(matches!(store.load(&key), ReadOutcome::Miss));
    assert_eq!(
        *warnings.lock().unwrap(),
        [
            StoreWarning::Entry(EntryFault::Foreign),
            StoreWarning::Entry(EntryFault::Damaged),
            StoreWarning::Directory
        ]
    );
    assert_eq!(store.stats().misses, 4);
    assert_eq!(store.stats().faults, 2);
    assert!(matches!(store.load(&key), ReadOutcome::Miss));
    assert_eq!(store.stats().misses, 5);
    assert_eq!(store.stats().faults, 2);
    assert_eq!(warnings.lock().unwrap().len(), 3);
    store.shutdown();
}
