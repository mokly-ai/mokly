//! Cache tree traversal without following symbolic links.

use std::fs;
use std::path::Path;

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
