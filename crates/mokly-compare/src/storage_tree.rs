//! Cache tree traversal without following symbolic links.

use std::fs;
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::{Error, InternalError, IoResult, Result};

pub(crate) fn validate_directory(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if !metadata.is_dir() => {
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

pub(crate) fn size(path: &Path, limit: u64) -> Result<u64> {
    validate_directory(path)?;
    let mut total = 0u64;
    let mut pending = vec![path.to_owned()];
    while let Some(directory) = pending.pop() {
        for item in fs::read_dir(directory).base()? {
            let item = item.base()?;
            let metadata = fs::symlink_metadata(item.path()).base()?;
            if metadata.is_dir() {
                pending.push(item.path());
            } else if metadata.is_file() || metadata.is_symlink() {
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

pub(crate) fn copy_tree(source: &Path, destination: &Path, limit: u64) -> Result<()> {
    size(source, limit)?;
    fs::create_dir(destination).base()?;
    let mut pending = vec![(source.to_owned(), destination.to_owned())];
    while let Some((source, destination)) = pending.pop() {
        for item in fs::read_dir(source).base()? {
            let item = item.base()?;
            let path = item.path();
            let target = destination.join(item.file_name());
            let metadata = fs::symlink_metadata(&path).base()?;
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

pub(crate) fn digest(path: &Path, limit: u64) -> Result<String> {
    validate_directory(path)?;
    let mut hash = Sha256::new();
    let mut pending = vec![path.to_owned()];
    let mut total = 0u64;
    while let Some(directory) = pending.pop() {
        let mut entries = fs::read_dir(directory)
            .base()?
            .collect::<std::io::Result<Vec<_>>>()
            .base()?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let file = entry.path();
            let relative = match file.strip_prefix(path) {
                Ok(relative) => relative,
                Err(_) => return Err(Error::UnsafeCache { path: file }),
            };
            frame(&mut hash, relative.as_os_str().as_encoded_bytes());
            let metadata = fs::symlink_metadata(&file).base()?;
            if metadata.is_dir() {
                hash.update([0]);
                pending.push(file);
            } else if metadata.is_symlink() {
                hash.update([1]);
                frame(
                    &mut hash,
                    fs::read_link(file).base()?.as_os_str().as_encoded_bytes(),
                );
                total = total.saturating_add(metadata.len());
            } else if metadata.is_file() {
                hash.update([2]);
                hash.update(metadata.len().to_le_bytes());
                let mut input = fs::File::open(file).base()?;
                let mut buffer = [0u8; 8192];
                loop {
                    let count = input.read(&mut buffer).base()?;
                    if count == 0 {
                        break;
                    }
                    total = total.saturating_add(count as u64);
                    if total > limit {
                        return Err(Error::CacheLimit { limit });
                    }
                    hash.update(&buffer[..count]);
                }
            } else {
                return Err(Error::UnsafeCache { path: file });
            }
            if total > limit {
                return Err(Error::CacheLimit { limit });
            }
        }
    }
    Ok(hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn frame(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_le_bytes());
    hash.update(bytes);
}
