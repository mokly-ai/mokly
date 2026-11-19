//! Constant-work access sequencing under the render namespace lock.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use crate::error::{Error, InternalError, IoResult, Result};
use crate::storage::SystemStorage;
use crate::storage_tree::{check, validate_directory, vanished};

pub(crate) fn next(storage: &SystemStorage, namespace: &Path, floor: u64) -> Result<Option<u64>> {
    check(storage.cancellation.as_ref())?;
    validate_directory(&storage.root, namespace)?;
    let path = namespace.join("access");
    let current = match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.is_file() && metadata.len() == 8 => {
            let mut bytes = [0; 8];
            fs::File::open(&path)
                .base()?
                .read_exact(&mut bytes)
                .base()?;
            u64::from_le_bytes(bytes)
        }
        Ok(_) => return Err(Error::UnsafeCache { path }),
        Err(error) if vanished(&error) => 0,
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    let Some(next) = current.max(floor).checked_add(1) else {
        return Ok(None);
    };
    let temporary = namespace.join("access.tmp");
    match fs::remove_file(&temporary) {
        Ok(()) => {}
        Err(error) if vanished(&error) => {}
        Err(source) => return Err(InternalError::Io { source }.into()),
    }
    fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .base()?
        .write_all(&next.to_le_bytes())
        .base()?;
    fs::rename(&temporary, &path).base()?;
    Ok(Some(next))
}
