//! Read the gzip-compressed tar archive of an upload Plan request.

use std::io::Read;

use flate2::read::GzDecoder;

/// The regular files of a gzip-compressed tar archive, in archive order.
///
/// Panics unless every entry is a regular file with the type flag `0`.
pub fn files(bytes: &[u8]) -> Vec<(String, Vec<u8>)> {
    let mut archive = tar::Archive::new(GzDecoder::new(bytes));
    archive
        .entries()
        .unwrap()
        .map(|entry| {
            let mut entry = entry.unwrap();
            assert_eq!(entry.header().as_bytes()[156], b'0');
            let name = entry.path().unwrap().to_string_lossy().replace('\\', "/");
            let mut contents = Vec::new();
            entry.read_to_end(&mut contents).unwrap();
            (name, contents)
        })
        .collect()
}
