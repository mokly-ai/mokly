//! Open regular files without following the final entry and hash bounded chunks.

use std::fs::{File, OpenOptions};
use std::io::Read;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::{Error, IoResult, Result};

pub(crate) fn open(path: &Path) -> Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    #[cfg(windows)]
    options.custom_flags(0x00200000);
    let file = options.open(path).at("open regular file", path)?;
    let metadata = file.metadata().at("inspect open file", path)?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(Error::Unexpected { path: path.into() });
    }
    Ok(file)
}

pub(crate) fn hash(path: &Path) -> Result<String> {
    let mut file = open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let read = file.read(&mut buffer).at("hash input", path)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}
