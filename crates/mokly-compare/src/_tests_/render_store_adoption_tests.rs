//! Replacement adoption preserves newer segments and updates the other indexed positions.

use std::io::Cursor;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use mokly_sidecar::bundle_store::RecordToken;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{Mutation, RawEntry, RawRead};
use crate::render_segment_buffer::{Append, SegmentBuffer};
use crate::render_store::{CachedDocuments, DocumentBackend, SegmentCacheMock, WriteOutcome};

fn key(name: &str) -> StoreKey {
    StoreKey::new(&NodeKey(name.into()), "build")
}

fn buffer(documents: &[(&str, &[u8])]) -> SegmentBuffer {
    let mut buffer = SegmentBuffer::new(1024 * 1024).unwrap();
    for (name, bytes) in documents {
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
        assert_eq!(buffer.append(&key(name), &document, None), Append::Added);
    }
    buffer
}

fn entry(bytes: Vec<u8>, token: u8) -> RawRead {
    RawRead::Entry(RawEntry {
        bytes: bytes.len() as u64,
        input: Box::new(Cursor::new(bytes)),
        token: RecordToken::new([token; 32]),
        runtime_digest: [0; 32],
        maintenance: None,
        guard: Box::new(Unimock::new(())),
    })
}

#[test]
fn adopting_a_replaced_segment_updates_its_positions_and_preserves_a_newer_segment() {
    let original = buffer(&[("a", b"old a"), ("b", b"old b"), ("c", b"old c")])
        .finish("current")
        .unwrap()
        .bytes()
        .to_vec();
    let replaced = buffer(&[
        ("c", b"replacement c\x80"),
        ("b", b"replacement b"),
        ("a", b"replacement a\0\xff"),
    ])
    .finish("current")
    .unwrap()
    .bytes()
    .to_vec();
    let mut newer = buffer(&[("b", b"newer b\n")]);
    let built = newer.finish("current").unwrap();
    let newer_bytes = built.bytes().to_vec();
    let newer_read = newer_bytes.clone();
    let store = CachedDocuments::new(
        Arc::new(Unimock::new((
            SegmentCacheMock::entries
                .some_call(matching!())
                .returns(Ok(Some(vec!["retained".into()]))),
            SegmentCacheMock::inspect
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, segment| {
                    Ok(if segment == "retained" {
                        entry(original.clone(), 7)
                    } else {
                        entry(newer_bytes.clone(), 9)
                    })
                })),
            SegmentCacheMock::read
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, segment| {
                    Ok(if segment == "retained" {
                        entry(replaced.clone(), 8)
                    } else {
                        entry(newer_read.clone(), 9)
                    })
                })),
            SegmentCacheMock::replace
                .some_call(matching!(_, _))
                .returns(Ok(Mutation::Written)),
        ))),
        "current".into(),
    );
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Miss
    ));
    assert_eq!(
        DocumentBackend::save(&store, &built),
        WriteOutcome::Written(1)
    );
    let ReadOutcome::Hit(first) = DocumentBackend::load(&store, &key("a")) else {
        panic!("the validated replacement must serve its requested document")
    };
    assert_eq!(first.bytes, b"replacement a\0\xff");
    let index = store.index.load_full().unwrap();
    assert_eq!(index[&key("a")].segment.token, RecordToken::new([8; 32]));
    assert_eq!(index[&key("c")].segment.token, RecordToken::new([8; 32]));
    assert_eq!(index[&key("b")].segment.token, RecordToken::new([9; 32]));
    for (name, expected) in [
        ("b", b"newer b\n".as_slice()),
        ("c", b"replacement c\x80".as_slice()),
    ] {
        let ReadOutcome::Hit(artifact) = DocumentBackend::load(&store, &key(name)) else {
            panic!("indexed document {name} must remain usable")
        };
        assert_eq!(artifact.bytes, expected, "document {name}");
    }
}
