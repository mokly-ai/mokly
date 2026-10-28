//! Sentinel framing keeps converted payloads exact, whatever their bytes or chunking.

use std::io::Write;

use crate::checkout_files::MemoryFiles;
use crate::checkout_output::BatchSink;
use crate::error::{Error, Result};
use crate::identity::{ObjectId, RepoPath};
use crate::tree::{Entry, Mode};

const SENTINEL: &str = "mokly-end-0123456789abcdef0123456789abcdef";

fn entry(name: &str, object: char) -> Entry {
    Entry {
        path: RepoPath::parse(name).unwrap(),
        object: ObjectId::parse(&object.to_string().repeat(40)).unwrap(),
        mode: Mode::File,
        size: 4,
    }
}

/// Git's output for these contents: a header with the raw size, then the converted bytes.
fn stream(entries: &[Entry], contents: &[&[u8]]) -> Vec<u8> {
    let mut output = Vec::new();
    for (entry, content) in entries.iter().zip(contents) {
        output.extend_from_slice(format!("{} blob {}\0", entry.object, entry.size).as_bytes());
        output.extend_from_slice(content);
        output.extend_from_slice(format!("\0{SENTINEL} missing\0").as_bytes());
    }
    output
}

/// Feeds `output` in the given chunk sizes and finishes the batch.
fn decode(
    entries: &[Entry],
    output: &[u8],
    chunks: &[usize],
    limit: usize,
) -> Result<Vec<Vec<u8>>> {
    let mut memory = MemoryFiles::new(entries.len());
    let mut sink = BatchSink::new(entries, &mut memory, SENTINEL, limit);
    let mut rest = output;
    let mut sizes = chunks.iter().cycle();
    while !rest.is_empty() {
        let size = (*sizes.next().unwrap()).clamp(1, rest.len());
        if sink.write_all(&rest[..size]).is_err() {
            return Err(sink.failure().unwrap());
        }
        rest = &rest[size..];
    }
    sink.finish()?;
    Ok(memory.into_files())
}

#[test]
fn every_chunk_split_preserves_binary_and_converted_payloads() {
    let entries = [
        entry("a", 'a'),
        entry("b", 'b'),
        entry("c", 'c'),
        entry("d", 'd'),
    ];
    let lookalike = format!("\0{SENTINEL}\0x blob 1\0 missing");
    let contents: [&[u8]; 4] = [
        &[0, 255, 10, 13, 0],
        b"one\r\ntwo\r\n",
        b"",
        lookalike.as_bytes(),
    ];
    let output = stream(&entries, &contents);
    for split in 1..output.len() {
        assert_eq!(
            decode(&entries, &output, &[split, output.len()], usize::MAX).unwrap(),
            contents,
            "split at {split}"
        );
    }
    assert_eq!(
        decode(&entries, &output, &[1], usize::MAX).unwrap(),
        contents
    );
}

#[test]
fn content_beyond_the_batch_bound_stops_the_batch() {
    let entries = [entry("a", 'a'), entry("b", 'b')];
    let output = stream(&entries, &[b"1234", b"5678"]);
    assert_eq!(decode(&entries, &output, &[3], 8).unwrap().len(), 2);
    assert!(matches!(
        decode(&entries, &output, &[3], 7),
        Err(Error::ByteLimit { limit: 7 })
    ));
}

#[test]
fn truncated_wrong_and_extra_records_never_supply_bytes() {
    let first = entry("a", 'a');
    let entries = [first.clone()];
    let end = format!("\0{SENTINEL} missing\0");
    for output in [
        format!("{} blob 2\0ab", first.object).into_bytes(),
        format!("{} blob 2\0ab\0{SENTINEL} miss", first.object).into_bytes(),
        format!("{} tree 0\0{end}", first.object).into_bytes(),
        format!("{} blob invalid\0{end}", first.object).into_bytes(),
        format!("{} missing\0", first.object).into_bytes(),
        format!("{} blob 0\0{end}", "b".repeat(40)).into_bytes(),
        format!("{} blob 1\0a{end}extra", first.object).into_bytes(),
        format!(
            "{} blob 1\0a{end}{} blob 1\0b{end}",
            first.object, first.object
        )
        .into_bytes(),
        b"missing header".to_vec(),
        vec![b'x'; 300],
        vec![0xff, b' ', b'b', 0],
    ] {
        assert!(
            matches!(
                decode(&entries, &output, &[7], usize::MAX),
                Err(Error::MalformedOutput)
            ),
            "{}",
            String::from_utf8_lossy(&output)
        );
    }
}
