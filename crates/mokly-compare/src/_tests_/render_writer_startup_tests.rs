//! Native hashing never blocks reads, and completed Changes releases key-only work.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_graph::cache::{Artifact, MemoryCache, RenderCache};
use mokly_graph::document_store::{DocumentStore, OfferOutcome, ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::render_image::{ImageIdentity, ImageSourceMock};
use crate::render_pending::TraceStoreObserver;
use crate::render_store::{DocumentBackendMock, WriteOutcome};
use crate::render_writer::{DocumentWriter, WriterLimits};
use crate::render_writer_control::Startup;

struct Release(Option<mpsc::Sender<()>>);
impl Drop for Release {
    fn drop(&mut self) {
        if let Some(sender) = self.0.take() {
            let _ = sender.send(());
        }
    }
}

#[test]
fn prepared_writer_reads_while_writes_wait_for_completed_changes() {
    let artifact = Arc::new(Artifact {
        bytes: b"complete document".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![],
            usage: CatalogueUsage::Pending,
            resources: vec![],
            components: vec![],
            links: vec![],
            warnings: vec![],
        }),
    });
    let cache: Arc<dyn RenderCache> =
        Arc::new(MemoryCache::new(256 * 1024 * 1024, 128 * 1024 * 1024));
    cache.insert(NodeKey("document".into()), artifact.clone());
    let (started, hashing) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let source = Arc::new(Unimock::new((
        ImageSourceMock::digest
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                started.send(()).unwrap();
                released.lock().unwrap().recv().unwrap();
                Some([4; 32])
            })),
        ImageSourceMock::cancelled
            .some_call(matching!())
            .returns(false),
    )));
    let (ready, bootstrapped) = mpsc::channel();
    let (write, written) = mpsc::channel();
    let writes = Arc::new(AtomicUsize::new(0));
    let count = writes.clone();
    let saved = artifact.clone();
    let backend = Arc::new(Unimock::new((
        DocumentBackendMock::initialize
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                ready.send(()).unwrap();
                ReadOutcome::Miss
            })),
        DocumentBackendMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| ReadOutcome::Hit(saved.clone()))),
        DocumentBackendMock::save
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, documents| {
                count.fetch_add(1, Ordering::SeqCst);
                write.send(()).unwrap();
                WriteOutcome::Written(documents.len())
            })),
    )));
    let store = DocumentWriter::prepared(
        backend,
        cache,
        WriterLimits::default(),
        Arc::new(TraceStoreObserver),
        Startup {
            identity: Arc::new(ImageIdentity::new(source)),
            context: "version:platform".into(),
        },
    );
    let mut release = Release(Some(release));
    hashing.recv().unwrap();
    assert_eq!(store.identity(), None);
    release.0.take().unwrap().send(()).unwrap();
    bootstrapped.recv().unwrap();
    assert!(
        store.identity().is_some(),
        "the writer must publish its prepared native identity"
    );
    let key = StoreKey::new(&NodeKey("document".into()), &store.identity().unwrap());
    assert_eq!(
        store.offer(key.clone(), NodeKey("document".into())),
        OfferOutcome::Queued
    );
    assert_eq!((store.stats().queued, store.stats().active), (1, 0));
    let ReadOutcome::Hit(hit) = store.load(&key) else {
        panic!("reads stay enabled while writes are paused")
    };
    assert_eq!(hit.bytes, artifact.bytes);
    assert_eq!(writes.load(Ordering::SeqCst), 0);
    store.resume();
    written.recv().unwrap();
    store.shutdown();
    assert_eq!(
        (
            store.stats().queued,
            store.stats().active,
            store.stats().writes,
            store.stats().drops
        ),
        (0, 0, 1, 0)
    );
}
