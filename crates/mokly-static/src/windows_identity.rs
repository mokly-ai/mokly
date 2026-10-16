//! Windows directory identity from a non-following handle, without nightly APIs.

use std::fs::OpenOptions;
use std::io;
use std::mem::MaybeUninit;
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::AsRawHandle;
use std::path::Path;

use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, GetFileInformationByHandle,
};

use crate::error::{Error, IoResult, Result};
use crate::filesystem::Identity;

pub(crate) fn identity(path: &Path) -> Result<Identity> {
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
        .at("open directory identity", path)?;
    let mut information = MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
    // SAFETY: The owned file handle remains live for the synchronous call.
    // The output pointer has the exact documented type and sufficient storage.
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), information.as_mut_ptr()) } == 0 {
        return Err(io::Error::last_os_error()).at("read directory identity", path);
    }
    // SAFETY: The successful API call initialized every field of the output structure.
    let information = unsafe { information.assume_init() };
    if information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0
        || information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
    {
        return Err(Error::Unexpected { path: path.into() });
    }
    let index =
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
    Ok(Identity {
        native: (u64::from(information.dwVolumeSerialNumber), index),
        created: file
            .metadata()
            .at("read directory creation time", path)?
            .created()
            .ok(),
    })
}
