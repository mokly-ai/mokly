//! Windows write-through publication after flushing regular-file contents.

use std::io;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;

use windows_sys::Win32::Storage::FileSystem::{
    MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
};

use crate::error::{InternalError, Result};

/// Replaces the target with `MOVEFILE_WRITE_THROUGH`, so the move is on disk
/// when the call returns. Windows has no directory flush to order the rename.
pub(crate) fn rename(source: &Path, target: &Path) -> Result<()> {
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    // SAFETY: Both UTF-16 path buffers are NUL-terminated and live through the call.
    // The entry/namespace locks exclude other Mokly writers to these cache-owned names.
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err(InternalError::Io {
            source: io::Error::last_os_error(),
        }
        .into());
    }
    Ok(())
}
