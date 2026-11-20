//! Effective global PAX persistence, local precedence and repeated local rejection.

use std::io::Cursor;
use std::sync::Arc;

use mkc_upload_memory::budget::ProcessUploadMemoryBudget;

use crate::archive::{GzipTarReader, TarballReader};
use crate::error::{Error, Rejection};
use crate::limits::Limits;

use super::pax_tests::{entry, gzip, record};

fn reader() -> GzipTarReader {
    GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024)))
}

#[test]
fn global_path_and_size_persist_after_local_overrides_and_global_updates() {
    let global = record("path", "global.html") + &record("size", "4");
    let local = record("path", "local.html") + &record("size", "3");
    let bytes = [
        entry(b"pax", b'g', global.as_bytes(), None),
        entry(b"pax", b'x', local.as_bytes(), None),
        entry(b"ignored-local", b'0', b"one", Some(0)),
        entry(b"ignored-global", b'0', b"four", Some(0)),
        entry(b"pax", b'g', record("path", "next.html").as_bytes(), None),
        entry(b"ignored-next", b'0', b"more", Some(0)),
        vec![0; 1024],
    ]
    .concat();
    let archive = reader()
        .read(&mut Cursor::new(gzip(&bytes)), Limits::default())
        .unwrap();
    assert_eq!(archive.files().len(), 3);
    assert_eq!(archive.files()["local.html"].as_ref(), b"one");
    assert_eq!(archive.files()["global.html"].as_ref(), b"four");
    assert_eq!(archive.files()["next.html"].as_ref(), b"more");
}

#[test]
fn rejects_two_consecutive_local_extended_headers() {
    let bytes = [
        entry(b"pax", b'x', record("path", "first").as_bytes(), None),
        entry(b"pax", b'x', record("path", "second").as_bytes(), None),
        entry(b"ignored", b'0', b"", None),
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
