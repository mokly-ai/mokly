//! Validated relative object names within the preview seed namespace.

use thiserror::Error;

use crate::store::MAX_FILE_BYTES;

/// One validated `seed/<run>/<file>` name, independent of physical prefixes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SeedName {
    object_name: String,
    max_bytes: u64,
}

/// Invalid components of a preview seed object name.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum Error {
    /// The run does not match `[a-z0-9][a-z0-9-]{0,49}`.
    #[error("[mkc-file-store-interface/seed_name] invalid seed run")]
    InvalidRun,
    /// The file is not a declared seed file or lowercase SHA-256 blob path.
    #[error("[mkc-file-store-interface/seed_name] invalid seed file")]
    InvalidFile,
}

impl SeedName {
    /// Validate the run and the exact relative file name without normalization.
    pub fn new(run: &str, file: &str) -> Result<Self, Error> {
        if !(1..=50).contains(&run.len())
            || !run
                .bytes()
                .next()
                .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
            || !run
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(Error::InvalidRun);
        }
        let max_bytes = match file {
            "catalogue/plan.tar.gz" => 100 * 1024 * 1024,
            "request.json" | "seed-status.json" | "seed-proof.json" => MAX_FILE_BYTES,
            _ => {
                let Some(hash) = file.strip_prefix("catalogue/blobs/") else {
                    return Err(Error::InvalidFile);
                };
                if hash.len() != 64
                    || !hash
                        .bytes()
                        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
                {
                    return Err(Error::InvalidFile);
                }
                MAX_FILE_BYTES
            }
        };
        Ok(Self {
            object_name: format!("seed/{run}/{file}"),
            max_bytes,
        })
    }

    /// Borrow the complete relative name, including `seed/<run>/`.
    pub fn as_str(&self) -> &str {
        &self.object_name
    }

    /// Return the 100 MiB plan ceiling or the 64 MiB ceiling for other objects.
    pub fn max_bytes(&self) -> u64 {
        self.max_bytes
    }
}

#[cfg(test)]
#[path = "_tests_/seed_name_tests.rs"]
mod tests;
