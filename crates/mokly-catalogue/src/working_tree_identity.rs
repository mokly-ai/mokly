//! Obtain a file-object identity from the same confined open used for source streams.

use std::fs::File;
#[cfg(windows)]
use std::mem::MaybeUninit;
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
use std::path::Path;

use mokly_source_interface::error::{Result, SourceError};
#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle,
};

use crate::working_tree_stream;

pub(crate) fn read(path: &Path) -> Result<Option<String>> {
    let Some((file, _)) = working_tree_stream::confined(path, "read file identity")? else {
        return Ok(None);
    };
    object(&file, path).map(Some)
}

#[cfg(unix)]
fn object(file: &File, path: &Path) -> Result<String> {
    match file.metadata() {
        Ok(metadata) => Ok(format!("{}:{}", metadata.dev(), metadata.ino())),
        Err(source) => Err(SourceError::Io {
            operation: "read file identity",
            path: path.into(),
            source,
        }),
    }
}

#[cfg(windows)]
fn object(file: &File, path: &Path) -> Result<String> {
    let mut information = MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
    // SAFETY: The owned file stays open throughout the call. The output has the exact API type and sufficient storage.
    if unsafe { GetFileInformationByHandle(file.as_raw_handle(), information.as_mut_ptr()) } == 0 {
        return Err(SourceError::Io {
            operation: "read file identity",
            path: path.into(),
            source: std::io::Error::last_os_error(),
        });
    }
    // SAFETY: A successful call initializes the complete output structure.
    let information = unsafe { information.assume_init() };
    let index =
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
    Ok(format!("{}:{index}", information.dwVolumeSerialNumber))
}
