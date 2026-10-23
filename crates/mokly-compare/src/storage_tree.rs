//! Cache tree traversal without following symbolic links.

use std::fs;
#[cfg(windows)]
use std::os::windows::fs::FileTypeExt;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use mokly_git::control::Cancellation;

use crate::error::{Error, InternalError, IoResult, Result};

pub(crate) fn validate_directory(root: &Path, path: &Path) -> Result<()> {
    if !path.starts_with(root) {
        return Err(Error::UnsafeCache {
            path: path.to_owned(),
        });
    }
    for ancestor in path.ancestors().take_while(|ancestor| *ancestor != root) {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if metadata.is_symlink() || !metadata.is_dir() => {
                return Err(Error::UnsafeCache {
                    path: ancestor.to_owned(),
                });
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(source) => return Err(InternalError::Io { source }.into()),
        }
    }
    Ok(())
}

pub(crate) fn size(
    root: &Path,
    path: &Path,
    limit: u64,
    cancellation: &dyn Cancellation,
) -> Result<u64> {
    validate_directory(root, path)?;
    let mut total = 0u64;
    let mut pending = vec![path.to_owned()];
    while let Some(directory) = pending.pop() {
        check(cancellation)?;
        let items = match fs::read_dir(directory) {
            Ok(items) => items,
            Err(error) if vanished(&error) => continue,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        for item in items {
            check(cancellation)?;
            let item = match item {
                Ok(item) => item,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            let metadata = match fs::symlink_metadata(item.path()) {
                Ok(value) => value,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            if metadata.is_symlink() {
                total = total.saturating_add(metadata.len());
            } else if metadata.is_dir() {
                pending.push(item.path());
            } else if metadata.is_file() {
                total = total.saturating_add(metadata.len());
            } else {
                return Err(Error::UnsafeCache { path: item.path() });
            }
            if total > limit {
                return Err(Error::CacheLimit { limit });
            }
        }
    }
    Ok(total)
}

pub(crate) fn copy_tree(
    root: &Path,
    source: &Path,
    destination: &Path,
    limit: u64,
    cancellation: &dyn Cancellation,
) -> Result<()> {
    size(root, source, limit, cancellation)?;
    fs::create_dir(destination).base()?;
    let mut pending = vec![(source.to_owned(), destination.to_owned())];
    while let Some((source, destination)) = pending.pop() {
        check(cancellation)?;
        for item in fs::read_dir(source).base()? {
            check(cancellation)?;
            let item = item.base()?;
            let path = item.path();
            let target = destination.join(item.file_name());
            let metadata = fs::symlink_metadata(&path).base()?;
            if metadata.is_symlink() {
                return Err(Error::UnsafeCache { path });
            }
            if metadata.is_dir() {
                fs::create_dir(&target).base()?;
                pending.push((path, target));
            } else if metadata.is_file() {
                fs::copy(path, target).base()?;
            } else {
                return Err(Error::UnsafeCache { path });
            }
        }
    }
    Ok(())
}

pub(crate) fn check(cancellation: &dyn Cancellation) -> Result<()> {
    if cancellation.cancelled() {
        Err(Error::Cancelled)
    } else {
        Ok(())
    }
}

pub(crate) fn vanished(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::NotFound | std::io::ErrorKind::NotADirectory
    )
}

/// Detach an unleased tree in constant filesystem work under the namespace lock.
pub(crate) fn retire(path: &Path, trash: &Path) -> Result<()> {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    loop {
        let name = format!(
            "{:032x}{:08x}",
            SEQUENCE.fetch_add(1, Ordering::Relaxed),
            std::process::id()
        );
        let target = trash.join(name);
        if fs::symlink_metadata(&target).is_ok() {
            continue;
        }
        return match fs::rename(path, target) {
            Ok(()) => Ok(()),
            Err(error) if vanished(&error) => Ok(()),
            Err(source) => Err(InternalError::Io { source }.into()),
        };
    }
}

pub(crate) fn remove(path: &Path, cancellation: &dyn Cancellation) -> Result<()> {
    let mut pending = vec![(path.to_owned(), false)];
    while let Some((path, visited)) = pending.pop() {
        check(cancellation)?;
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if vanished(&error) => continue,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if metadata.is_dir() && !metadata.is_symlink() && !visited {
            pending.push((path.clone(), true));
            let items = match fs::read_dir(&path) {
                Ok(items) => items,
                Err(error) if vanished(&error) => continue,
                Err(source) => return Err(InternalError::Io { source }.into()),
            };
            for item in items {
                check(cancellation)?;
                match item {
                    Ok(item) => pending.push((item.path(), false)),
                    Err(error) if vanished(&error) => {}
                    Err(source) => return Err(InternalError::Io { source }.into()),
                }
            }
        } else {
            let result = if metadata.is_dir() || directory_link(&metadata) {
                fs::remove_dir(&path)
            } else {
                fs::remove_file(&path)
            };
            match result {
                Ok(()) => {}
                Err(error) if vanished(&error) => {}
                Err(source) => return Err(InternalError::Io { source }.into()),
            }
        }
    }
    Ok(())
}

fn directory_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        metadata.file_type().is_symlink_dir()
    }
    #[cfg(not(windows))]
    {
        let _ = metadata;
        false
    }
}
