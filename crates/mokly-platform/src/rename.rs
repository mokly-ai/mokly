//! Atomic rename that never overwrites a destination.

use std::path::Path;

use crate::error::{Error, IoResult, Result};
#[cfg(unix)]
use crate::unix;
#[cfg(windows)]
use crate::windows;

/// Output transaction's exclusive rename boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RenameMock))]
pub trait Rename: Send + Sync {
    /// Atomically move a file or directory only if the destination is absent.
    fn exclusive(&self, source: &Path, destination: &Path) -> Result<()>;
}

/// Host implementation using the OS no-replace rename primitive.
///
/// The filesystem checks absence and renames in one step, with no copy
/// fallback. The rename and the read of its OS error are one synchronous call,
/// with no asynchronous hop, so the error read is always this rename's own.
/// Primary references:
/// [Linux rename semantics](https://www.kernel.org/doc/html/latest/filesystems/vfs.html),
/// [Apple rename flags](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h),
/// and [Windows `MoveFileExW`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).
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
