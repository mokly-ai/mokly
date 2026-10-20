//! Range verification retains byte boundaries and streams once for all ranges.

use std::collections::BTreeSet;
use std::io::{self, Cursor, Read};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};

use crate::range_evidence::verify;
use crate::read_evidence::ReadBaseline;
use crate::stream::{OpenedSource, SourceStream};
use crate::tree::SourceTreeMock;

fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn range(offset: u64, bytes: &[u8], eof: bool) -> ReadBaseline {
    ReadBaseline::ObservedRange {
        offset,
        length: bytes.len() as u64,
        eof,
        digest: digest(bytes),
    }
}

fn check(bytes: &[u8], ranges: BTreeSet<ReadBaseline>) -> bool {
    let raw = bytes.to_vec();
    let tree = Unimock::new(
        SourceTreeMock::open_stream
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let source: Box<dyn SourceStream> = Box::new(OpenedSource {
                    reader: Box::new(Cursor::new(raw.clone())),
                    length: raw.len() as u64,
                });
                Ok(source)
            })),
    );
    verify(&tree, Path::new("/file"), &ranges, &digest(bytes))
}

#[test]
fn overlaps_conflicting_versions_short_files_and_eof_keep_their_meaning() {
    assert!(check(
        b"abcdef",
        BTreeSet::from([
            range(0, b"abc", false),
            range(1, b"bcd", false),
            range(6, b"", true)
        ])
    ));
    assert!(check(b"abcXYZ", BTreeSet::from([range(0, b"abc", false)])));
    assert!(check(b"abc", BTreeSet::from([range(9, b"", true)])));
    assert!(!check(
        b"abcdef",
        BTreeSet::from([range(0, b"abc", false), range(0, b"xyz", false)])
    ));
    assert!(!check(b"ab", BTreeSet::from([range(0, b"abc", false)])));
    assert!(!check(b"abcd", BTreeSet::from([range(0, b"abc", true)])));
}

struct Counted {
    bytes: Cursor<Vec<u8>>,
    reads: Arc<AtomicUsize>,
}
impl Read for Counted {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        self.reads.fetch_add(1, Ordering::Relaxed);
        self.bytes.read(buffer)
    }
}

#[test]
fn range_checks_share_one_stream_and_linear_byte_reads() {
    let mut counts = Vec::new();
    for size in [4, 16] {
        let bytes = vec![b'x'; size * 64 * 1024];
        let ranges = (0..size)
            .map(|index| {
                range(
                    (index * 64 * 1024) as u64,
                    &bytes[index * 64 * 1024..(index + 1) * 64 * 1024],
                    false,
                )
            })
            .collect();
        let reads = Arc::new(AtomicUsize::new(0));
        let raw = bytes.clone();
        let observed = reads.clone();
        let tree = Unimock::new(
            SourceTreeMock::open_stream
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    let source: Box<dyn SourceStream> = Box::new(OpenedSource {
                        length: raw.len() as u64,
                        reader: Box::new(Counted {
                            bytes: Cursor::new(raw.clone()),
                            reads: observed.clone(),
                        }),
                    });
                    Ok(source)
                })),
        );
        assert!(verify(&tree, Path::new("/file"), &ranges, &digest(&bytes)));
        counts.push(reads.load(Ordering::Relaxed));
    }
    assert!(counts[0] > 0);
    assert!(counts[1] * 2 <= counts[0] * 9);
}
