//! Segment readers inventory once and reject foreign headers before reading payloads.

use std::io::{self, Cursor, Read, Seek, SeekFrom};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use mokly_sidecar::bundle_store::RecordToken;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_cache_types::{Mutation, RawEntry, RawRead};
use crate::render_segment_buffer::{Append, SegmentBuffer};
use crate::render_store::{CachedDocuments, DocumentBackend, SegmentCacheMock};

#[derive(Clone)]
struct Record {
    key: StoreKey,
    document: Arc<EncodedView>,
}

fn encode(records: &[Record], version: &str) -> Option<Vec<u8>> {
    let mut buffer = SegmentBuffer::new(1024 * 1024)?;
    for record in records {
        assert_eq!(
            buffer.append(&record.key, &record.document, None),
            Append::Added
        );
    }
    Some(buffer.finish(version)?.bytes().to_vec())
}

fn records(count: usize) -> Vec<Record> {
    let artifact = Artifact {
        bytes: b"complete".to_vec(),
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
    let document = Arc::new(EncodedView::encode(&artifact).unwrap());
    (0..count)
        .map(|index| Record {
            key: StoreKey::new(&NodeKey(index.to_string()), "build"),
            document: document.clone(),
        })
        .collect()
}

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

fn reads(count: usize) -> (usize, usize, usize) {
    let records = records(count);
    let bytes = Arc::new(encode(&records, "current").unwrap());
    let inventory = Arc::new(AtomicUsize::new(0));
    let inspections = Arc::new(AtomicUsize::new(0));
    let lookups = Arc::new(AtomicUsize::new(0));
    let inventoried = inventory.clone();
    let inspected = inspections.clone();
    let looked_up = lookups.clone();
    let input = bytes.clone();
    let cache = Arc::new(Unimock::new((
        SegmentCacheMock::entries
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                inventoried.fetch_add(1, Ordering::SeqCst);
                Ok(Some(vec!["segment".into()]))
            })),
        SegmentCacheMock::inspect
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                inspected.fetch_add(1, Ordering::SeqCst);
                Ok(entry(input.as_ref().clone()))
            })),
        SegmentCacheMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                looked_up.fetch_add(1, Ordering::SeqCst);
                Ok(entry(bytes.as_ref().clone()))
            })),
    )));
    let store = CachedDocuments::new(cache, "current".into());
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Miss
    ));
    for record in &records {
        let ReadOutcome::Hit(artifact) = store.load(&record.key) else {
            panic!("retained document")
        };
        assert_eq!(artifact.bytes, b"complete");
    }
    (
        inventory.load(Ordering::SeqCst),
        inspections.load(Ordering::SeqCst),
        lookups.load(Ordering::SeqCst),
    )
}

#[test]
fn segment_inventory_runs_once_for_many_document_reads() {
    assert_eq!(reads(4), (1, 1, 4));
    assert_eq!(reads(16), (1, 1, 16));
}

#[test]
fn a_lookup_after_contended_preparation_never_inventories_and_explicit_preparation_recovers() {
    let documents = records(1);
    let bytes = encode(&documents, "current").unwrap();
    let inspected = bytes.clone();
    let cache = Arc::new(Unimock::new((
        SegmentCacheMock::entries.stub(|each| {
            each.call(matching!())
                .answers(&|_| Ok(None))
                .once()
                .then()
                .answers(&|_| Ok(Some(vec!["segment".into()])));
        }),
        SegmentCacheMock::inspect
            .some_call(matching!("segment"))
            .answers_arc(Arc::new(move |_, _| Ok(entry(inspected.clone())))),
        SegmentCacheMock::read
            .some_call(matching!("segment"))
            .answers_arc(Arc::new(move |_, _| Ok(entry(bytes.clone())))),
    )));
    let store = CachedDocuments::new(cache, "current".into());
    assert!(matches!(store.load(&documents[0].key), ReadOutcome::Miss));
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Miss
    ));
    assert!(
        matches!(store.load(&documents[0].key), ReadOutcome::Miss),
        "a lookup must not retry contended index preparation"
    );
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Miss
    ));
    let ReadOutcome::Hit(artifact) = store.load(&documents[0].key) else {
        panic!("explicit preparation must recover the still-enabled store")
    };
    assert_eq!(artifact.bytes, b"complete");
}

#[test]
fn a_full_startup_index_keeps_recent_positions_and_the_newest_duplicate() {
    let mut documents = records(16_385);
    let duplicate = Record {
        key: documents[0].key.clone(),
        document: documents[1].document.clone(),
    };
    documents.push(duplicate);
    let segments: Vec<_> = documents
        .chunks(64)
        .map(|batch| encode(batch, "current").unwrap())
        .collect();
    let input = Arc::new(segments);
    let inspected = input.clone();
    let read = input.clone();
    let cache = Arc::new(Unimock::new((
        SegmentCacheMock::entries
            .some_call(matching!())
            .returns(Ok(Some(
                (0..input.len()).map(|index| index.to_string()).collect(),
            ))),
        SegmentCacheMock::inspect
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                Ok(entry(inspected[key.parse::<usize>().unwrap()].clone()))
            })),
        SegmentCacheMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, key| {
                Ok(entry(read[key.parse::<usize>().unwrap()].clone()))
            })),
    )));
    let store = CachedDocuments::new(cache, "current".into());
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Miss
    ));
    assert!(
        matches!(store.load(&documents[16_384].key), ReadOutcome::Hit(_)),
        "the most recent position must survive the index bound"
    );
    assert!(matches!(store.load(&documents[0].key), ReadOutcome::Hit(_)));
    let index = store.index.load();
    assert_eq!(index.as_ref().unwrap().len(), 16_384);
    assert_eq!(
        index.as_ref().unwrap()[&documents[0].key].segment.key,
        (input.len() - 1).to_string()
    );
}

struct HeaderOnly {
    prefix: Cursor<Vec<u8>>,
    payload_reads: Arc<AtomicUsize>,
}
impl Read for HeaderOnly {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        if self.prefix.position() == self.prefix.get_ref().len() as u64 {
            self.payload_reads.fetch_add(1, Ordering::SeqCst);
            return Err(io::Error::other("payload must not be read"));
        }
        self.prefix.read(bytes)
    }
}
impl Seek for HeaderOnly {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        self.prefix.seek(position)
    }
}

#[test]
fn a_foreign_segment_is_rejected_before_its_payload_is_read() {
    let mut bytes = encode(&records(1), "current").unwrap();
    let size = bytes.len();
    let mut length = [0; 4];
    length.copy_from_slice(&bytes[8..12]);
    bytes.truncate(12 + u32::from_le_bytes(length) as usize);
    let header = String::from_utf8(bytes[12..].to_vec())
        .unwrap()
        .replace("\"formatVersion\":1", "\"formatVersion\":2")
        .into_bytes();
    let mut prefix = bytes[..12].to_vec();
    prefix.extend_from_slice(&header);
    let payload_reads = Arc::new(AtomicUsize::new(0));
    let counted = payload_reads.clone();
    let cache = Arc::new(Unimock::new((
        SegmentCacheMock::entries
            .some_call(matching!())
            .returns(Ok(Some(vec!["segment".into()]))),
        SegmentCacheMock::inspect
            .some_call(matching!(_))
            .returns(Ok(RawRead::Entry(RawEntry {
                bytes: size as u64,
                input: Box::new(HeaderOnly {
                    prefix: Cursor::new(prefix),
                    payload_reads: counted,
                }),
                token: RecordToken::new([7; 32]),
                runtime_digest: [0; 32],
                maintenance: None,
                guard: Box::new(Unimock::new(())),
            }))),
        SegmentCacheMock::invalidate
            .some_call(matching!(_, _))
            .returns(Ok(Mutation::Invalidated)),
    )));
    let store = CachedDocuments::new(cache, "current".into());
    assert!(matches!(
        DocumentBackend::initialize(&store),
        ReadOutcome::Rejected(EntryFault::Foreign)
    ));
    assert_eq!(payload_reads.load(Ordering::SeqCst), 0);
}
