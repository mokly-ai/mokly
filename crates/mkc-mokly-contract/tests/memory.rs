//! Allocation regressions for archive paths and bounded JSON artifact decoding.

#![allow(clippy::unwrap_used)]

use std::alloc::System;
use std::fmt::Write;

use stats_alloc::{INSTRUMENTED_SYSTEM, Region, StatsAlloc};

use mkc_mokly_contract::archive::ArchiveFiles;
use mkc_mokly_contract::error::{ArtifactKind, Error, Limit};
use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::inventory::Inventory;
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::scanned_archive::ScannedArchive;

#[global_allocator]
static GLOBAL: &StatsAlloc<System> = &INSTRUMENTED_SYSTEM;

fn files(count: usize, segments: usize) -> ArchiveFiles {
    let alphabet = b"0123456789abcdefghijklmnopqrstuvwxyz";
    (0..count)
        .map(|index| {
            let mut parts = vec!["a".to_owned(); segments];
            for digit in 0..3 {
                parts[digit] =
                    char::from(alphabet[(index / 36_usize.pow(digit as u32)) % 36]).to_string();
            }
            let padding = 1023 - parts.join("/").len();
            parts[3].push_str(&"a".repeat(padding));
            let path = parts.join("/");
            assert_eq!(path.len(), 1023);
            (path, Vec::new().into())
        })
        .collect()
}

#[test]
fn adversarial_allocations_and_retention_are_bounded() {
    path_allocations();
    json_allocations();
}

fn path_allocations() {
    for (segments, expected, allocated_maximum) in [
        (512, Limit::PathSegments, 64 * 1024),
        (64, Limit::PrefixCount, 80 * 1024 * 1024),
    ] {
        let files = files(20_000, segments);
        let region = Region::new(GLOBAL);
        let result = ScannedArchive::from_files(files, Limits::default());
        let stats = region.change();
        assert!(matches!(result, Err(Error::TooLarge { limit }) if limit == expected));
        assert!(
            stats.bytes_allocated < allocated_maximum,
            "{segments} segments: {stats:?}"
        );
        println!(
            "20,000 paths, {segments} segments: {} allocated bytes before 413",
            stats.bytes_allocated
        );
    }
    let files = files(1_000, 64);
    let region = Region::new(GLOBAL);
    let archive = ScannedArchive::from_files(files, Limits::default()).unwrap();
    let stats = region.change();
    let retained = stats.bytes_allocated - stats.bytes_deallocated;
    assert!(retained < 8 * 1024 * 1024, "{stats:?}");
    assert_eq!(archive.files().len(), 1_000);
    println!("1,000 valid deep paths: {retained} retained index bytes");
}

fn parse(bytes: &[u8], artifact: ArtifactKind) -> Result<(), Error> {
    match artifact {
        ArtifactKind::Inventory => Inventory::parse(bytes, Limits::default()).map(|_| ()),
        ArtifactKind::Index => CatalogueIndex::parse(bytes, Limits::default()).map(|_| ()),
        ArtifactKind::Envelope => unreachable!(),
    }
}

fn measured(bytes: &[u8], artifact: ArtifactKind, limit: Limit, maximum: usize) {
    let region = Region::new(GLOBAL);
    let result = parse(bytes, artifact);
    let stats = region.change();
    assert!(
        matches!(result, Err(Error::TooLarge { limit: actual }) if actual == limit),
        "{result:?}"
    );
    assert!(
        stats.bytes_allocated < maximum,
        "{artifact:?}/{limit:?}: {stats:?}"
    );
    let retained = stats
        .bytes_allocated
        .saturating_sub(stats.bytes_deallocated);
    assert!(retained < 32 * 1024, "{artifact:?}/{limit:?}: {stats:?}");
    println!(
        "{artifact:?}/{limit:?}: input {}, allocated {}, retained {retained}",
        bytes.len(),
        stats.bytes_allocated
    );
}

/// Construct the original multi-million-entry attack without counting input creation.
fn many_files(size: usize, artifact: ArtifactKind) -> Vec<u8> {
    let mut bytes = match artifact {
        ArtifactKind::Index => br#"{"schemaVersion":9,"screens":["#.to_vec(),
        _ => br#"{"schemaVersion":3,"files":["#.to_vec(),
    };
    while bytes.len() + 6 <= size {
        bytes.extend_from_slice(br#""a","#);
    }
    bytes.pop();
    bytes.extend_from_slice(b"]}");
    bytes.resize(size, b' ');
    bytes
}

/// Numeric unique keys reproduce the ignored-field attack; long keys expose String retention.
fn many_keys(size: usize, width: usize, artifact: ArtifactKind) -> Vec<u8> {
    let mut text = String::with_capacity(size);
    text.push_str(match artifact {
        ArtifactKind::Index => r#"{"schemaVersion":9,"screens":[],"extra":{"#,
        _ => r#"{"schemaVersion":3,"files":[],"extra":{"#,
    });
    let mut index = 0;
    loop {
        let length = text.len();
        write!(text, "\"{index:0width$}\":0,").unwrap();
        if text.len() + 2 > size {
            text.truncate(length);
            break;
        }
        index += 1;
    }
    text.pop();
    text.push_str("}}");
    let mut bytes = text.into_bytes();
    bytes.resize(size, b' ');
    bytes
}

fn json_allocations() {
    let depth = format!("{}0{}", "[".repeat(16_384), "]".repeat(16_384));
    for (artifact, limit) in [
        (ArtifactKind::Inventory, Limit::Inventory),
        (ArtifactKind::Index, Limit::Index),
    ] {
        measured(
            &many_files(64 * 1024 * 1024, artifact),
            artifact,
            limit,
            1024,
        );
        measured(
            &many_keys(64 * 1024 * 1024, 1, artifact),
            artifact,
            limit,
            1024,
        );
        let nodes = many_files(2 * 1024 * 1024, artifact);
        let keys = many_keys(3 * 1024 * 1024, 32, artifact);
        measured(&nodes, artifact, Limit::JsonNodes, 64 * 1024);
        measured(&keys, artifact, Limit::JsonKeys, 12 * 1024 * 1024);
        measured(depth.as_bytes(), artifact, Limit::JsonDepth, 64 * 1024);
    }
    let bytes = many_keys(2 * 1024 * 1024, 32, ArtifactKind::Inventory);
    let region = Region::new(GLOBAL);
    let accepted = Inventory::parse(&bytes, Limits::default()).unwrap();
    let stats = region.change();
    assert!(stats.bytes_allocated < 16 * 1024 * 1024, "{stats:?}");
    let retained = stats
        .bytes_allocated
        .saturating_sub(stats.bytes_deallocated);
    assert!(retained < 32 * 1024, "{stats:?}");
    assert!(accepted.files.is_empty());
    println!(
        "Accepted ignored object: allocated {}, retained {retained}",
        stats.bytes_allocated
    );
}
