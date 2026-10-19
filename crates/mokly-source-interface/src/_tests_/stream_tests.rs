//! Stream checks preserve bytes and reject edits before private buffers are published.

use std::io::{self, Cursor, Read, Write};
use std::path::Path;

use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};

use crate::error::SourceError;
use crate::stream::{OpenedSource, SourceStream};

fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[derive(Default)]
struct Sink {
    writes: usize,
    bytes: Vec<u8>,
}
impl Write for Sink {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        assert!(bytes.len() <= 64 * 1024);
        self.writes += 1;
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn delivery_copies_in_bounded_chunks_with_linear_write_counts() {
    for (length, writes) in [(64 * 1024, 1), (4 * 64 * 1024, 4)] {
        let bytes = vec![42; length];
        let mut stream: Box<dyn SourceStream> = Box::new(OpenedSource {
            length: length as u64,
            reader: Box::new(Cursor::new(bytes.clone())),
        });
        let mut sink = Sink::default();
        stream
            .copy_verified(Path::new("image.bin"), &hash(&bytes), &mut sink)
            .unwrap();
        assert_eq!(sink.bytes, bytes);
        assert_eq!(sink.writes, writes);
    }
}

#[test]
fn same_size_edits_truncation_and_growth_never_pass_the_generation_check() {
    for (bytes, length) in [
        (b"edited".as_slice(), 6),
        (b"old".as_slice(), 6),
        (b"longer!".as_slice(), 6),
    ] {
        let mut stream: Box<dyn SourceStream> = Box::new(OpenedSource {
            length,
            reader: Box::new(Cursor::new(bytes.to_vec())),
        });
        assert!(
            matches!(stream.copy_verified(Path::new("asset.svg"), &hash(b"before"), &mut Vec::new()), Err(SourceError::Changed { path }) if path == Path::new("asset.svg"))
        );
    }
}

#[test]
fn empty_assets_have_the_empty_digest_and_empty_output() {
    let mut stream: Box<dyn SourceStream> = Box::new(OpenedSource {
        length: 0,
        reader: Box::new(Cursor::new(Vec::<u8>::new())),
    });
    let mut output = Vec::new();
    stream
        .copy_verified(Path::new("empty.svg"), &hash(&[]), &mut output)
        .unwrap();
    assert!(output.is_empty());
}

#[unimock::unimock(api = ReadMock)]
trait ReadCalls: Send {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize>;
}

struct Reader(Unimock);

impl Read for Reader {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        ReadCalls::read(&mut self.0, buffer)
    }
}

#[test]
fn interrupted_reads_retry_without_losing_bytes_or_changing_the_digest() {
    let reader = Unimock::new((
        ReadMock::read
            .next_call(matching!(_))
            .returns(Err(io::ErrorKind::Interrupted.into())),
        ReadMock::read
            .next_call(matching!(_))
            .answers(&|_, buffer| {
                buffer[..3].copy_from_slice(b"one");
                Ok(3)
            }),
        ReadMock::read
            .next_call(matching!(_))
            .returns(Err(io::ErrorKind::Interrupted.into())),
        ReadMock::read
            .next_call(matching!(_))
            .answers(&|_, buffer| {
                buffer[..3].copy_from_slice(b"two");
                Ok(3)
            }),
        ReadMock::read.next_call(matching!(_)).returns(Ok(0)),
    ));
    let mut stream = OpenedSource {
        reader: Box::new(Reader(reader)),
        length: 6,
    };
    let mut output = Vec::new();
    stream
        .copy_verified(Path::new("image.svg"), &hash(b"onetwo"), &mut output)
        .unwrap();
    assert_eq!(output, b"onetwo");
}

#[test]
fn other_read_errors_keep_the_original_io_diagnostic() {
    let reader = Unimock::new(
        ReadMock::read
            .next_call(matching!(_))
            .returns(Err(io::ErrorKind::PermissionDenied.into())),
    );
    let mut stream = OpenedSource {
        reader: Box::new(Reader(reader)),
        length: 6,
    };
    assert!(
        matches!(stream.copy_verified(Path::new("image.svg"), "unused", &mut Vec::new()),
        Err(SourceError::Io { operation: "stream source", path, source })
        if path == Path::new("image.svg") && source.kind() == io::ErrorKind::PermissionDenied)
    );
}
