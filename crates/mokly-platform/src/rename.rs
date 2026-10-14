//! Atomic rename that never overwrites a destination.

use std::path::Path;

use crate::error::{Error, IoResult, Result};
#[cfg(unix)]
use crate::unix;
#[cfg(windows)]
use crate::windows;

/// Output transaction's exclusive rename boundary.
#[cfg_attr(test, unimock::unimock(api = RenameMock))]
pub trait Rename: Send + Sync {
    /// Atomically move a file or directory only if the destination is absent.
    fn exclusive(&self, source: &Path, destination: &Path) -> Result<()>;
}

/// Host implementation using the OS no-replace rename primitive.
pub struct SystemRename;

impl Rename for SystemRename {
    fn exclusive(&self, source: &Path, destination: &Path) -> Result<()> {
        tracing::trace!("performing exclusive rename");
        #[cfg(unix)]
        let result = unix::exclusive_rename(source, destination)?;
        #[cfg(windows)]
        let result = windows::exclusive_rename(source, destination)?;
        match result {
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                Err(Error::DestinationExists {
                    path: destination.to_owned(),
                })
            }
            result => result.platform(),
        }
    }
}
