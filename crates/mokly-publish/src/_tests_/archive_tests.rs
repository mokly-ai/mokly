//! Plan archive encoding and independently reduced resource bounds.

use std::io::Read;

use flate2::read::GzDecoder;
use mokly_model::output::artifact::File;

use crate::error::Error;

use super::bounded_archive;

#[test]
fn ustar_pax_preserves_long_unicode_paths_and_exact_binary_bytes() {
    let path = format!("{}/{}", "é".repeat(140), "asset.bin");
    let bytes = b"\0\xff\x80binary\0";
    let file = File {
        path: path.clone(),
        bytes: bytes.as_slice().into(),
    };
    let archive = bounded_archive(&[file], 512 * 1024 * 1024, 100 * 1024 * 1024).unwrap();
    let mut tar = tar::Archive::new(GzDecoder::new(archive.as_slice()));
    let mut entries = tar.entries().unwrap();
    let mut entry = entries.next().unwrap().unwrap();
    assert_eq!(entry.path().unwrap().to_str().unwrap(), path);
    assert!(entry.header().entry_type().is_file());
    let mut body = Vec::new();
    entry.read_to_end(&mut body).unwrap();
    assert_eq!(body, bytes);
    assert!(entries.next().is_none());
}

#[test]
fn tar_and_compressed_limits_fail_independently() {
    let file = File {
        path: "file".to_owned(),
        bytes: b"content".as_slice().into(),
    };
    assert!(matches!(
        bounded_archive(std::slice::from_ref(&file), 1023, 100 * 1024 * 1024),
        Err(Error::TooLarge)
    ));
    assert!(matches!(
        bounded_archive(std::slice::from_ref(&file), 512 * 1024 * 1024, 1),
        Err(Error::TooLarge)
    ));
    assert!(bounded_archive(&[file], 512 * 1024 * 1024, 100 * 1024 * 1024).is_ok());
}
