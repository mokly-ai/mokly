//! Single-member gzip framing and bounded tar scanning.

use std::cell::Cell;
use std::io::{self, BufRead, BufReader, Read};

use flate2::bufread::GzDecoder;

use crate::archive::{GzipTarReader, TarballReader};
use crate::budget::Budget;
use crate::error::{Error, Limit, Rejection, Result, invalid};
use crate::limits::Limits;
use crate::manifest::UploadManifest;
use crate::scanned_archive::ScannedArchive;
use crate::tar_scan::{Scanner, TarScanner};

impl TarballReader for GzipTarReader {
    fn read(&self, source: &mut dyn Read, limits: Limits) -> Result<ScannedArchive> {
        self.read_with_envelope(source, limits, &mut None)
    }

    fn read_with_envelope(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive> {
        *envelope = None;
        let compressed = Cell::new(false);
        let decompressed = Cell::new(false);
        let mut body = Budget {
            inner: source,
            remaining: limits.compressed(),
            exceeded: &compressed,
        };
        let mut buffered = BufReader::with_capacity(8192, &mut body);
        let mut result = {
            let mut gzip = GzDecoder::new(&mut buffered);
            let valid_header = gzip.header().is_some();
            let mut tar = Budget {
                inner: &mut gzip,
                remaining: limits.decompressed(),
                exceeded: &decompressed,
            };
            let scanner: &dyn Scanner = &TarScanner {
                memory: self.memory.clone(),
            };
            let mut result = if valid_header {
                scanner.scan(&mut tar, limits, envelope)
            } else {
                Err(invalid(Rejection::Gzip))
            };
            if !matches!(result, Err(Error::TooLarge { .. } | Error::Unavailable))
                && io::copy(&mut tar, &mut io::sink()).is_err()
            {
                result = Err(invalid(Rejection::Gzip));
            }
            result
        };
        if !matches!(result, Err(Error::TooLarge { .. } | Error::Unavailable)) {
            match buffered.fill_buf() {
                Ok([]) => {}
                _ => result = Err(invalid(Rejection::Gzip)),
            }
            if io::copy(&mut buffered, &mut io::sink()).is_err() {
                result = Err(invalid(Rejection::Gzip));
            }
        }
        if compressed.get() {
            return Err(Error::TooLarge {
                limit: Limit::Compressed,
            });
        }
        if decompressed.get() {
            return Err(Error::TooLarge {
                limit: Limit::Decompressed,
            });
        }
        result
    }
}
