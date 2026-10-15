//! Deterministic regular-file USTAR/PAX Plan archive creation.

use std::io::Write;

use flate2::{Compression, GzBuilder};
use mokly_model::output::artifact::File;
use tar::{Builder, EntryType, Header};

use crate::error::{Error, InternalError, Result};

pub(crate) fn plan_archive(files: &[File]) -> Result<Vec<u8>> {
    bounded_archive(files, 512 * 1024 * 1024, 100 * 1024 * 1024)
}

fn bounded_archive(files: &[File], tar_limit: usize, compressed_limit: usize) -> Result<Vec<u8>> {
    let mut archive = Builder::new(Vec::new());
    for file in files {
        let mut header = Header::new_ustar();
        header.set_entry_type(EntryType::Regular);
        header.set_mode(0o644);
        header.set_uid(0);
        header.set_gid(0);
        header.set_mtime(0);
        header.set_size(file.bytes.len() as u64);
        if header.set_path(&file.path).is_err() {
            if let Err(source) = archive.append_pax_extensions([("path", file.path.as_bytes())]) {
                return Err(Error::Internal(InternalError::Archive { source }));
            }
            if let Err(source) = header.set_path("PaxPayload") {
                return Err(Error::Internal(InternalError::Archive { source }));
            }
        }
        header.set_cksum();
        if let Err(source) = archive.append(&header, file.bytes.as_ref()) {
            return Err(Error::Internal(InternalError::Archive { source }));
        }
    }
    let bytes = match archive.into_inner() {
        Ok(bytes) => bytes,
        Err(source) => return Err(Error::Internal(InternalError::Archive { source })),
    };
    if bytes.len() > tar_limit {
        return Err(Error::TooLarge);
    }
    let mut compressed = GzBuilder::new()
        .mtime(0)
        .write(Vec::new(), Compression::default());
    if let Err(source) = compressed.write_all(&bytes) {
        return Err(Error::Internal(InternalError::Archive { source }));
    }
    let bytes = match compressed.finish() {
        Ok(bytes) => bytes,
        Err(source) => return Err(Error::Internal(InternalError::Archive { source })),
    };
    if bytes.len() > compressed_limit {
        return Err(Error::TooLarge);
    }
    Ok(bytes)
}

#[cfg(test)]
#[path = "_tests_/archive_tests.rs"]
mod archive_tests;
