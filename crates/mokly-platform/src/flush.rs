//! Filesystem durability primitives without per-file drive-cache barriers.

use std::fs;
#[cfg(unix)]
use std::os::fd::AsRawFd;
use std::path::Path;

use crate::error::{IoResult, Result};

/// Flush operations used before publishing a completed cache entry.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FlushMock))]
pub trait Flush: Send + Sync {
    /// Flush the containing filesystem once; false requests the per-file fallback.
    fn filesystem(&self, path: &Path) -> Result<bool>;
    /// Flush one file with plain fsync on Unix, without Apple's F_FULLFSYNC.
    fn file(&self, path: &Path) -> Result<()>;
    /// Flush directory metadata where the platform supports it.
    fn directory(&self, path: &Path) -> Result<()>;
}

/// Host filesystem flush adapter.
pub struct SystemFlush;

impl Flush for SystemFlush {
    fn filesystem(&self, path: &Path) -> Result<bool> {
        #[cfg(target_os = "linux")]
        {
            let file = fs::File::open(path).platform()?;
            // SAFETY: the descriptor belongs to the live file for this syncfs call.
            let status = unsafe { libc::syncfs(file.as_raw_fd()) };
            result(status)?;
            Ok(true)
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = path;
            Ok(false)
        }
    }

    fn file(&self, path: &Path) -> Result<()> {
        #[cfg(unix)]
        {
            let file = fs::File::open(path).platform()?;
            plain(&file)
        }
        #[cfg(windows)]
        {
            fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(path)
                .platform()?
                .sync_all()
                .platform()
        }
    }

    fn directory(&self, path: &Path) -> Result<()> {
        #[cfg(unix)]
        {
            let file = fs::File::open(path).platform()?;
            plain(&file)
        }
        #[cfg(windows)]
        {
            let _ = path;
            Ok(())
        }
    }
}

#[cfg(unix)]
fn plain(file: &fs::File) -> Result<()> {
    // SAFETY: the borrowed file keeps its valid descriptor alive during fsync.
    result(unsafe { libc::fsync(file.as_raw_fd()) })
}

#[cfg(unix)]
fn result(status: libc::c_int) -> Result<()> {
    if status == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error()).platform()
    }
}
