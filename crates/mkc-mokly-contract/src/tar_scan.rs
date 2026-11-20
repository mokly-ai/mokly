//! Header-by-header USTAR parsing that exposes special entries and padding.

use std::io::{self, Read};
use std::str;
use std::sync::Arc;

use bytes::Bytes;
use mkc_upload_memory_interface::budget::{UploadMemoryBudget, UploadMemoryReservation};
use tar::Header;

use crate::archive::ArchiveFiles;
use crate::error::{ArtifactKind, Error, Limit, Rejection, Result, invalid};
use crate::limits::Limits;
use crate::manifest::UploadManifest;
use crate::paths::Namespace;
use crate::pax::{Overrides, PaxReader, PosixPax};
use crate::scanned_archive::ScannedArchive;

pub(crate) trait Scanner {
    fn scan(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive>;
}

pub(crate) struct TarScanner {
    pub(crate) memory: Arc<dyn UploadMemoryBudget>,
}

struct ReservedFile {
    bytes: Vec<u8>,
    _reservation: Arc<dyn UploadMemoryReservation>,
}

impl AsRef<[u8]> for ReservedFile {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}

impl Scanner for TarScanner {
    fn scan(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive> {
        let mut files = ArchiveFiles::new();
        let mut namespace = Namespace::new(limits);
        let mut failure = None;
        let mut global = Overrides::default();
        let mut local = None;
        let mut count = 0;
        let mut directories = 0;
        let mut consumed = 0_u64;
        loop {
            let mut block = [0; 512];
            if let Err(error) = source.read_exact(&mut block) {
                return Err(read_error(error));
            }
            consumed += 512;
            if block == [0; 512] {
                if local.is_some() {
                    failure.get_or_insert(invalid(Rejection::Pax));
                }
                if let Err(error) = source.read_exact(&mut block) {
                    return Err(read_error(error));
                }
                if block != [0; 512] {
                    failure.get_or_insert(invalid(Rejection::Tar));
                }
                loop {
                    match source.read(&mut block) {
                        Ok(0) => break,
                        Ok(count) if block[..count].iter().all(|b| *b == 0) => {}
                        Ok(_) => {
                            failure.get_or_insert(invalid(Rejection::Tar));
                        }
                        Err(error) => return Err(read_error(error)),
                    }
                }
                return match failure {
                    Some(error) => Err(error),
                    None => Ok(ScannedArchive { files, directories }),
                };
            }
            let header = Header::from_byte_slice(&block);
            let expected: u32 = block
                .iter()
                .enumerate()
                .map(|(i, b)| {
                    if (148..156).contains(&i) {
                        32
                    } else {
                        u32::from(*b)
                    }
                })
                .sum();
            if header.cksum().ok() != Some(expected)
                || &block[257..263] != b"ustar\0"
                || &block[263..265] != b"00"
            {
                return Err(invalid(Rejection::Tar));
            }
            let mut size = match header.entry_size() {
                Ok(size) => size,
                Err(_) => return Err(invalid(Rejection::Tar)),
            };
            let kind = block[156];
            if matches!(kind, b'x' | b'g') {
                ensure_remaining(consumed, size, limits)?;
                let result = {
                    let mut entry = source.take(size);
                    let pax: &dyn PaxReader = &PosixPax;
                    let result = pax.read(&mut entry, size, limits);
                    if let Err(error @ Error::TooLarge { .. }) = result {
                        return Err(error);
                    }
                    if let Err(error) = io::copy(&mut entry, &mut io::sink()) {
                        return Err(read_error(error));
                    }
                    if entry.limit() != 0 {
                        return Err(invalid(Rejection::Truncated));
                    }
                    result
                };
                match result {
                    Ok(overrides) if kind == b'g' => {
                        if overrides.path.is_some() {
                            global.path = overrides.path;
                        }
                        if overrides.size.is_some() {
                            global.size = overrides.size;
                        }
                    }
                    Ok(overrides) => {
                        if local.is_some() {
                            failure.get_or_insert(invalid(Rejection::Pax));
                        }
                        local = Some(overrides);
                    }
                    Err(error) => {
                        failure.get_or_insert(error);
                    }
                }
            } else {
                let next = local.take().unwrap_or_default();
                size = next.size.or(global.size).unwrap_or(size);
                let header_path = header.path_bytes();
                let path = match next.path.as_deref().or(global.path.as_deref()) {
                    Some(path) => Some(path.to_owned()),
                    None => match str::from_utf8(&header_path) {
                        Ok(path) => Some(path.to_owned()),
                        Err(_) => {
                            failure.get_or_insert(invalid(Rejection::Path));
                            None
                        }
                    },
                };
                let directory = kind == b'5';
                let regular = matches!(kind, 0 | b'0');
                let path = path.map(|path| {
                    if directory {
                        path.strip_suffix('/').unwrap_or(&path).to_owned()
                    } else {
                        path
                    }
                });
                if regular {
                    count += 1;
                    if count > limits.files() {
                        return Err(Error::TooLarge {
                            limit: Limit::FileCount,
                        });
                    }
                    limits.check_file(size, path.as_deref().and_then(ArtifactKind::at_path))?;
                } else if !directory {
                    failure.get_or_insert(invalid(Rejection::EntryType));
                } else if size != 0 {
                    failure.get_or_insert(invalid(Rejection::Tar));
                } else {
                    directories += 1;
                }
                ensure_remaining(consumed, size, limits)?;
                if let Some(path) = &path {
                    match namespace.insert(path, directory) {
                        Err(error @ Error::TooLarge { .. }) => return Err(error),
                        Err(error) => {
                            failure.get_or_insert(error);
                        }
                        Ok(()) => {}
                    }
                }
                if regular && failure.is_none() {
                    let reservation = match self.memory.reserve(size) {
                        Ok(reservation) => reservation,
                        Err(_) => return Err(Error::Unavailable),
                    };
                    let mut bytes = vec![0; size as usize];
                    if let Err(error) = source.read_exact(&mut bytes) {
                        return Err(read_error(error));
                    }
                    if let Some(path) = path {
                        if path == "mokly-upload.json" {
                            *envelope = UploadManifest::parse(&bytes, limits).ok();
                        }
                        files.insert(
                            path,
                            Bytes::from_owner(ReservedFile {
                                bytes,
                                _reservation: reservation,
                            }),
                        );
                    }
                } else {
                    match io::copy(&mut source.take(size), &mut io::sink()) {
                        Ok(read) if read == size => {}
                        Ok(_) => return Err(invalid(Rejection::Truncated)),
                        Err(error) => return Err(read_error(error)),
                    }
                }
            }
            let padding = (512 - size % 512) % 512;
            if let Err(error) = source.read_exact(&mut block[..padding as usize]) {
                return Err(read_error(error));
            }
            if block[..padding as usize].iter().any(|b| *b != 0) {
                failure.get_or_insert(invalid(Rejection::Tar));
            }
            consumed += size + padding;
        }
    }
}

fn ensure_remaining(consumed: u64, size: u64, limits: Limits) -> Result<()> {
    if size > limits.decompressed().saturating_sub(consumed) {
        return Err(Error::TooLarge {
            limit: Limit::Decompressed,
        });
    }
    Ok(())
}

fn read_error(error: io::Error) -> Error {
    invalid(if error.kind() == io::ErrorKind::UnexpectedEof {
        Rejection::Truncated
    } else {
        Rejection::Gzip
    })
}
