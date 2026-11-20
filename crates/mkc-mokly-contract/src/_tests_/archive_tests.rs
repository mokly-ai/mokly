//! Malicious archive regressions precede the streaming implementation.

use std::io::{Cursor, Write};
use std::sync::Arc;

use flate2::Compression;
use flate2::write::GzEncoder;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use mkc_upload_memory_interface::budget::UploadMemoryBudget;
use tar::Header;

use crate::archive::{GzipTarReader, TarballReader};
use crate::error::{Error, Limit, Rejection};
use crate::limits::{Limits, Quotas};

fn gzip(bytes: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(bytes).unwrap();
    encoder.finish().unwrap()
}

fn header(path: &str, size: u64, kind: u8) -> Vec<u8> {
    let mut header = Header::new_ustar();
    header.set_path(path).unwrap();
    header.set_size(size);
    header.set_entry_type(tar::EntryType::new(kind));
    header.set_cksum();
    header.as_bytes().to_vec()
}

fn entry(path: &str, bytes: &[u8]) -> Vec<u8> {
    let mut data = header(path, bytes.len() as u64, b'0');
    data.extend_from_slice(bytes);
    data.resize(data.len().div_ceil(512) * 512, 0);
    data
}

fn reader() -> GzipTarReader {
    GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024)))
}

fn read(tar: &[u8], limits: Limits) -> Error {
    reader()
        .read(&mut Cursor::new(gzip(tar)), limits)
        .unwrap_err()
}

#[test]
fn rejects_an_entry_that_exhausts_process_memory_before_allocating_its_body() {
    let tar = [
        entry("first.bin", b"1234"),
        entry("second.bin", b"5678"),
        vec![0; 1024],
    ]
    .concat();
    let reader = GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(6)));

    assert!(matches!(
        reader.read(&mut Cursor::new(gzip(&tar)), Limits::default()),
        Err(Error::Unavailable)
    ));
}

#[test]
fn cloned_file_bytes_retain_their_reservation_until_the_final_owner_drops() {
    let tar = [entry("file.bin", b"1234"), vec![0; 1024]].concat();
    let budget = Arc::new(ProcessUploadMemoryBudget::new(4));
    let retained = {
        let reader = GzipTarReader::new(budget.clone());
        let archive = reader
            .read(&mut Cursor::new(gzip(&tar)), Limits::default())
            .unwrap();
        let retained = archive.files()["file.bin"].clone();
        assert!(budget.reserve(1).is_err());
        retained
    };
    assert!(budget.reserve(1).is_err());
    {
        let _final_owner = retained;
    }
    assert!(budget.reserve(4).is_ok());
}

#[test]
fn rejects_corrupt_gzip_and_trailing_members() {
    for bytes in [vec![1, 2, 3], [gzip(&[0; 1024]), gzip(&[])].concat()] {
        assert!(matches!(
            reader().read(&mut Cursor::new(bytes), Limits::default()),
            Err(Error::Invalid {
                reason: Rejection::Gzip
            })
        ));
    }
}

#[test]
fn rejects_invalid_tar_checksum_truncation_and_trailing_data() {
    let mut checksum = entry("index.html", b"hello");
    checksum[0] = b'X';
    let mut trailing = vec![0; 1024];
    trailing.push(1);
    for bytes in [checksum, header("x", 7, b'0'), trailing, vec![0; 512]] {
        assert!(matches!(
            read(&bytes, Limits::default()),
            Error::Invalid { .. }
        ));
    }
}

#[test]
fn rejects_links_and_special_entries() {
    for kind in *b"12346S7LK" {
        let bytes = [header("x", 0, kind), vec![0; 1024]].concat();
        assert!(matches!(
            read(&bytes, Limits::default()),
            Error::Invalid {
                reason: Rejection::EntryType
            }
        ));
    }
}

#[test]
fn rejects_duplicates_case_collisions_and_file_directory_conflicts() {
    for paths in [["x", "x"], ["CAFÉ", "café"], ["x", "x/y"], ["x/y", "x"]] {
        let bytes = [entry(paths[0], b""), entry(paths[1], b""), vec![0; 1024]].concat();
        assert!(matches!(
            read(&bytes, Limits::default()),
            Error::Invalid { .. }
        ));
    }
}

#[test]
fn stops_at_each_limit_before_reading_missing_entry_body() {
    for (limits, tar, expected) in [
        (
            Limits::lowered(Quotas {
                file: 3,
                ..Quotas::default()
            }),
            header("x", 4, b'0'),
            Limit::File,
        ),
        (
            Limits::lowered(Quotas {
                manifest: 3,
                ..Quotas::default()
            }),
            header("mokly-upload.json", 4, b'0'),
            Limit::Manifest,
        ),
        (
            Limits::lowered(Quotas {
                files: 0,
                ..Quotas::default()
            }),
            header("x", 0, b'0'),
            Limit::FileCount,
        ),
        (
            Limits::lowered(Quotas {
                path: 2,
                ..Quotas::default()
            }),
            header("long", 0, b'0'),
            Limit::Path,
        ),
        (
            Limits::lowered(Quotas {
                path_segments: 1,
                ..Quotas::default()
            }),
            header("a/b", 10, b'0'),
            Limit::PathSegments,
        ),
        (
            Limits::lowered(Quotas {
                prefixes: 1,
                ..Quotas::default()
            }),
            header("a/b", 10, b'0'),
            Limit::PrefixCount,
        ),
        (
            Limits::lowered(Quotas {
                decompressed: 10,
                ..Quotas::default()
            }),
            vec![0; 1024],
            Limit::Decompressed,
        ),
        (
            Limits::lowered(Quotas {
                compressed: 10,
                ..Quotas::default()
            }),
            vec![0; 1024],
            Limit::Compressed,
        ),
    ] {
        assert!(matches!(read(&tar, limits), Error::TooLarge { limit } if limit == expected));
    }
}

#[test]
fn scans_after_structural_failure_for_limit_precedence() {
    let data = [header("link", 0, b'2'), header("large", 4, b'0')].concat();
    assert!(matches!(
        read(
            &data,
            Limits::lowered(Quotas {
                file: 3,
                ..Quotas::default()
            })
        ),
        Error::TooLarge { limit: Limit::File }
    ));
}

#[test]
fn accepts_regular_files_at_inclusive_limits() {
    let tar = [entry("x", b"abcd"), vec![0; 1024]].concat();
    let compressed = gzip(&tar);
    let limits = Limits::lowered(Quotas {
        compressed: compressed.len() as u64,
        decompressed: tar.len() as u64,
        file: 4,
        files: 1,
        path: 1,
        ..Quotas::default()
    });
    let files = reader().read(&mut Cursor::new(compressed), limits).unwrap();
    assert_eq!(files.files()["x"].as_ref(), b"abcd");
}

#[test]
fn artifact_byte_quotas_precede_reading_the_missing_body() {
    for (path, expected) in [
        (".mokly-export-artifact", Limit::Inventory),
        ("mokly-viewer/index.json", Limit::Index),
    ] {
        let limits = Limits::lowered(Quotas {
            inventory: 3,
            index: 3,
            ..Quotas::default()
        });
        assert!(
            matches!(read(&header(path, 4, b'0'), limits), Error::TooLarge { limit } if limit == expected)
        );
    }
}
