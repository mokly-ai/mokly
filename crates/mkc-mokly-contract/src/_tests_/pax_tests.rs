//! Effective PAX metadata, raw paths, padding, quotas, and gzip corruption.

use std::io::{Cursor, Write};
use std::sync::Arc;

use flate2::Compression;
use flate2::write::GzEncoder;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use tar::Header;

use crate::archive::{GzipTarReader, TarballReader};
use crate::error::{Error, Limit, Rejection};
use crate::limits::{Limits, Quotas};

fn reader() -> GzipTarReader {
    GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024)))
}

pub(super) fn record(key: &str, value: &str) -> String {
    let payload = format!(" {key}={value}\n");
    let mut length = payload.len() + 1;
    loop {
        let actual = payload.len() + length.to_string().len();
        if actual == length {
            return format!("{length}{payload}");
        }
        length = actual;
    }
}

pub(super) fn entry(path: &[u8], kind: u8, body: &[u8], size: Option<u64>) -> Vec<u8> {
    let mut header = Header::new_ustar();
    header.set_size(size.unwrap_or(body.len() as u64));
    header.set_entry_type(tar::EntryType::new(kind));
    header.as_mut_bytes()[..path.len()].copy_from_slice(path);
    header.set_cksum();
    let mut bytes = header.as_bytes().to_vec();
    bytes.extend(body);
    bytes.resize(bytes.len().div_ceil(512) * 512, 0);
    bytes
}

pub(super) fn gzip(tar: &[u8]) -> Vec<u8> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(tar).unwrap();
    encoder.finish().unwrap()
}

#[test]
fn applies_local_and_global_pax_with_unicode_path_and_size() {
    let local = record("path", "unicode/é.html") + &record("size", "4") + &record("mtime", "0");
    let global = record("uid", "1000");
    let bytes = [
        entry(b"pax", b'g', global.as_bytes(), None),
        entry(b"pax", b'x', local.as_bytes(), None),
        entry(b"ignored", b'0', b"text", Some(0)),
        vec![0; 1024],
    ]
    .concat();
    let files = reader()
        .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
        .unwrap();
    assert_eq!(files.files()["unicode/é.html"].as_ref(), b"text");
}

#[test]
fn rejects_pax_links_sparse_unknown_duplicate_and_dangling_metadata() {
    for metadata in [
        record("linkpath", "../escape"),
        record("GNU.sparse.size", "4"),
        record("unknown", "value"),
        record("path", "x") + &record("path", "y"),
        "invalid pax".to_owned(),
    ] {
        let bytes = [
            entry(b"pax", b'x', metadata.as_bytes(), None),
            entry(b"x", b'0', b"", None),
            vec![0; 1024],
        ]
        .concat();
        assert!(matches!(
            reader().read(&mut Cursor::new(gzip(&bytes)), Limits::default()),
            Err(Error::Invalid {
                reason: Rejection::Pax
            })
        ));
    }
    let bytes = [
        entry(b"pax", b'x', record("path", "x").as_bytes(), None),
        vec![0; 1024],
    ]
    .concat();
    assert!(
        reader()
            .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
            .is_err()
    );
}

#[test]
fn validates_effective_pax_paths_and_quotas_before_content() {
    for path in [
        "../escape",
        "/absolute",
        "a//b",
        "a/./b",
        "C:path",
        "a\\b",
        "a\n",
    ] {
        let bytes = [
            entry(b"pax", b'x', record("path", path).as_bytes(), None),
            entry(b"safe", b'0', b"", None),
            vec![0; 1024],
        ]
        .concat();
        assert!(
            reader()
                .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
                .is_err(),
            "{path}"
        );
    }
    for (key, value, limits, expected) in [
        (
            "path",
            "long",
            Limits::lowered(Quotas {
                path: 3,
                ..Quotas::default()
            }),
            Limit::Path,
        ),
        (
            "size",
            "4",
            Limits::lowered(Quotas {
                file: 3,
                ..Quotas::default()
            }),
            Limit::File,
        ),
    ] {
        let bytes = [
            entry(b"pax", b'x', record(key, value).as_bytes(), None),
            entry(b"x", b'0', b"", None),
        ]
        .concat();
        assert!(
            matches!(reader().read(&mut Cursor::new(gzip(&bytes)),limits),Err(Error::TooLarge { limit }) if limit == expected)
        );
    }
}

#[test]
fn raw_paths_are_not_normalized_and_non_utf8_is_rejected() {
    for path in [
        b"../x".as_slice(),
        b"./x",
        b"a//b",
        b"/root",
        b"a\\b",
        b"a\x7f",
        b"\xff",
    ] {
        let bytes = [entry(path, b'0', b"", None), vec![0; 1024]].concat();
        assert!(
            reader()
                .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
                .is_err(),
            "{path:?}"
        );
    }
}

#[test]
fn accepts_optional_directories_and_rejects_case_or_file_aliases() {
    let bytes = [
        entry(b"dir/", b'5', b"", None),
        entry(b"dir/", b'5', b"", None),
        entry(b"dir/x", b'0', b"", None),
        vec![0; 1024],
    ]
    .concat();
    assert!(
        reader()
            .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
            .is_ok()
    );
    for entries in [
        [entry(b"X", b'0', b"", None), entry(b"x", b'0', b"", None)],
        [entry(b"x/", b'5', b"", None), entry(b"x", b'0', b"", None)],
    ] {
        let bytes = [entries.concat(), vec![0; 1024]].concat();
        assert!(
            reader()
                .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
                .is_err()
        );
    }
}

#[test]
fn rejects_corrupt_checksums_truncated_gzip_and_nonzero_entry_padding() {
    let bytes = [entry(b"x", b'0', b"x", None), vec![0; 1024]].concat();
    let valid = gzip(&bytes);
    let mut crc = valid.clone();
    let index = crc.len() - 8;
    crc[index] ^= 1;
    for compressed in [
        crc,
        valid[..valid.len() - 1].to_vec(),
        [valid.clone(), vec![0]].concat(),
    ] {
        assert!(
            reader()
                .read(&mut Cursor::new(compressed), Limits::default())
                .is_err()
        );
    }
    let mut bytes = bytes;
    bytes[513] = 1;
    assert!(
        reader()
            .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
            .is_err()
    );
}
