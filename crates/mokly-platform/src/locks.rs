//! Nonblocking shared and exclusive file locks with handle-scoped release.

use std::fs::{File, OpenOptions, TryLockError};
use std::path::Path;

use crate::error::{Error, InternalError, IoResult, Result};

/// A held shared or exclusive lock; closing this object releases the OS lock.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock())]
pub trait FileLock: Send + Sync {}

/// File lock acquisition boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = LocksMock))]
pub trait Locks: Send + Sync {
    /// Open or create a lock file, then acquire its exclusive lock.
    fn try_lock(&self, path: &Path) -> Result<Box<dyn FileLock>>;
    /// Acquire a shared read lease that prevents exclusive eviction.
    fn try_lock_shared(&self, path: &Path) -> Result<Box<dyn FileLock>>;
}

/// Host file lock implementation.
pub struct SystemLocks;

struct HeldLock {
    _file: File,
}

impl FileLock for HeldLock {}

impl Locks for SystemLocks {
    fn try_lock(&self, path: &Path) -> Result<Box<dyn FileLock>> {
        acquire(path, false)
    }

    fn try_lock_shared(&self, path: &Path) -> Result<Box<dyn FileLock>> {
        acquire(path, true)
    }
}

fn acquire(path: &Path, shared: bool) -> Result<Box<dyn FileLock>> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
        .platform()?;
    match if shared {
        file.try_lock_shared()
    } else {
        file.try_lock()
    } {
        Ok(()) => Ok(Box::new(HeldLock { _file: file })),
        Err(TryLockError::WouldBlock) => Err(Error::Locked {
            path: path.to_owned(),
        }),
        Err(TryLockError::Error(source)) => Err(Error::Internal(InternalError::Io { source })),
    }
}
