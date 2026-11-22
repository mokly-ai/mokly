//! Current content digests of source files, for the admission of released recipes.

use std::fs::File;
use std::io::{self, ErrorKind, Read};
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::compiled::CompiledGeneration;

/// Reads the digest of a current source file as the sidecar's reuse check does.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = SourceDigestsMock))]
pub trait SourceDigests: Send + Sync {
    /// The lowercase SHA-256 digest of all bytes of a regular file, or `None` when it is missing.
    fn digest(&self, path: &Path) -> io::Result<Option<String>>;
}

/// Source digests from the native file system.
pub struct SystemSourceDigests;

impl SourceDigests for SystemSourceDigests {
    fn digest(&self, path: &Path) -> io::Result<Option<String>> {
        let mut file = match File::open(path) {
            Ok(file) => file,
            Err(error)
                if matches!(error.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) =>
            {
                return Ok(None);
            }
            Err(error) => return Err(error),
        };
        if !file.metadata()?.is_file() {
            return Err(io::Error::from(ErrorKind::InvalidInput));
        }
        let mut hash = Sha256::new();
        let mut buffer = vec![0_u8; 64 * 1024];
        loop {
            let count = match file.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => count,
                Err(error) if error.kind() == ErrorKind::Interrupted => continue,
                Err(error) => return Err(error),
            };
            hash.update(&buffer[..count]);
        }
        Ok(Some(
            hash.finalize()
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
        ))
    }
}

/// Whether a current source differs from the released recipe at a path whose digests differ.
///
/// Only the sources that the two compilations record with different digests are read, each
/// once, until the first difference. A missing or unreadable source rules nothing out.
pub(crate) fn rules_out(
    released: &CompiledGeneration,
    live: &CompiledGeneration,
    digests: &dyn SourceDigests,
) -> bool {
    released
        .inputs
        .iter()
        .filter(|(path, recorded)| live.inputs.get(*path) != Some(*recorded))
        .any(
            |(path, recorded)| match (recorded, digests.digest(Path::new(path))) {
                (Some(recorded), Ok(Some(current))) => current != *recorded,
                _ => false,
            },
        )
}
