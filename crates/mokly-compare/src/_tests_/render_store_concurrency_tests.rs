//! Indexed reads keep exact documents while another thread owns store maintenance.

use std::io::Cursor;
use std::sync::{Arc, mpsc};
use std::thread;

use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use mokly_sidecar::bundle_store::RecordToken;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{RawEntry, RawRead};
use crate::render_segment_buffer::{Append, SegmentBuffer};
use crate::render_store::{CachedDocuments, DocumentBackend, SegmentCacheMock};

fn entry(bytes: Vec<u8>) -> RawRead {
    RawRead::Entry(RawEntry {
        bytes: bytes.len() as u64,
        input: Box::new(Cursor::new(bytes)),
        token: RecordToken::new([7; 32]),
        runtime_digest: [0; 32],
        maintenance: None,
        guard: Box::new(Unimock::new(())),
    })
}

#[test]
fn concurrent_indexed_reads_hit_while_another_thread_owns_maintenance() {
    let documents: [(&str, &[u8]); 4] = [
        ("first", b"first\0document\xff"),
        ("second", b"second document\n"),
        ("third", b"third document\r\n"),
        ("fourth", b"fourth document\x80"),
    ];
    let mut buffer = SegmentBuffer::new(1024 * 1024).unwrap();
    let keys: Vec<_> = documents
        .iter()
        .map(|(name, bytes)| {
            let key = StoreKey::new(&NodeKey((*name).into()), "build");
            let artifact = Artifact {
                bytes: bytes.to_vec(),
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
            };
            let document = EncodedView::encode(&artifact).unwrap();
            assert_eq!(buffer.append(&key, &document, None), Append::Added);
            key
        })
        .collect();
    let bytes = buffer.finish("current").unwrap().bytes().to_vec();
    let inspected = bytes.clone();
    let store = Arc::new(CachedDocuments::new(
        Arc::new(Unimock::new((
            SegmentCacheMock::entries
                .some_call(matching!())
                .returns(Ok(Some(vec!["segment".into()]))),
            SegmentCacheMock::inspect
                .some_call(matching!("segment"))
                .answers_arc(Arc::new(move |_, _| Ok(entry(inspected.clone())))),
            SegmentCacheMock::read
                .each_call(matching!("segment"))
                .answers_arc(Arc::new(move |_, _| Ok(entry(bytes.clone())))),
        ))),
        "current".into(),
    ));
    assert!(matches!(
        DocumentBackend::initialize(store.as_ref()),
        ReadOutcome::Miss
    ));
    assert!(matches!(
        DocumentBackend::load(store.as_ref(), &keys[0]),
        ReadOutcome::Hit(_)
    ));

    let (held, waiting) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let maintaining = store.clone();
    let maintenance = thread::spawn(move || {
        let _owner = maintaining.maintenance.lock().unwrap();
        held.send(()).unwrap();
        released.recv().unwrap();
    });
    waiting.recv().unwrap();
    let readers: Vec<_> = (0..4)
        .map(|_| {
            let store = store.clone();
            let keys = keys.clone();
            thread::spawn(move || {
                keys.iter()
                    .map(|key| {
                        (
                            DocumentBackend::contains(store.as_ref(), key),
                            DocumentBackend::load(store.as_ref(), key),
                        )
                    })
                    .collect::<Vec<_>>()
            })
        })
        .collect();
    let results: Vec<_> = readers.into_iter().map(|reader| reader.join()).collect();
    release.send(()).unwrap();
    maintenance.join().unwrap();

    for (reader, result) in results.into_iter().enumerate() {
        let outcomes = result.unwrap();
        assert_eq!(outcomes.len(), 4);
        for ((present, outcome), (name, expected)) in outcomes.into_iter().zip(documents) {
            assert!(
                present,
                "reader {reader} must find indexed document {name} during maintenance"
            );
            assert!(
                matches!(&outcome, ReadOutcome::Hit(_)),
                "reader {reader} must hit indexed document {name} during maintenance: {outcome:?}"
            );
            let ReadOutcome::Hit(artifact) = outcome else {
                unreachable!()
            };
            assert_eq!(artifact.bytes, expected, "reader {reader}, document {name}");
        }
    }
}
