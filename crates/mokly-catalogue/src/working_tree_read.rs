//! Open inventoried files without following a replacement symbolic link.

use std::fs::{File, OpenOptions};
use std::io::{self, Read};
use std::path::Path;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

use mokly_source_interface::error::{Result, SourceError};
use sha2::{Digest, Sha256};

#[cfg(windows)]
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;

fn open(path: &Path) -> Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW);
    #[cfg(windows)]
    options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    let file = match options.open(path) {
        Ok(file) => file,
        Err(source) => return Err(failure(path, source)),
    };
    let metadata = match file.metadata() {
        Ok(metadata) => metadata,
        Err(source) => return Err(failure(path, source)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(failure(path, io::Error::from(io::ErrorKind::InvalidInput)));
    }
    Ok(file)
}

pub(crate) fn read(path: &Path) -> Result<Vec<u8>> {
    let mut file = open(path)?;
    let mut bytes = Vec::new();
    match file.read_to_end(&mut bytes) {
        Ok(_) => Ok(bytes),
        Err(source) => Err(failure(path, source)),
    }
}

fn failure(path: &Path, source: io::Error) -> SourceError {
    SourceError::Io {
        operation: "read",
        path: path.into(),
        source,
    }
}

pub(crate) fn digest(path: &Path) -> Result<String> {
    let mut file = open(path)?;
    let mut hash = Sha256::new();
    let mut chunk = [0u8; 64 * 1024];
    loop {
        let count = match file.read(&mut chunk) {
            Ok(count) => count,
            Err(source) => return Err(failure(path, source)),
        };
        if count == 0 {
            break;
        }
        hash.update(&chunk[..count]);
    }
    Ok(hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>())
}
