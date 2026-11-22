//! Live authored reads compare exact bytes before reusing an immutable capture.

use std::collections::BTreeMap;
use std::fs::File;
use std::io::{self, BufRead, BufReader, Read, Take};
use std::sync::{Arc, Mutex};

use crate::asset_streams::{AssetVersion, AtOffset, SharedAsset};
use crate::error::{InternalError, Result};
use crate::public_read::{OpenedFile, PublicReader};

const CHUNK: usize = 64 * 1024;
type VersionSlot = Arc<Mutex<Option<Arc<AssetVersion>>>>;

/// Retain the last served version of each reached authored route in this generation.
#[derive(Default)]
pub(crate) struct AuthoredAssets(Mutex<BTreeMap<String, VersionSlot>>);

impl AuthoredAssets {
    /// Open through the live policy while serialized with other reads of this route.
    pub(crate) fn open(
        &self,
        path: &str,
        reader: &dyn PublicReader,
    ) -> Result<Option<SharedAsset>> {
        let slot = {
            let mut versions = self.0.lock().unwrap_or_else(|error| error.into_inner());
            versions.entry(path.to_owned()).or_default().clone()
        };
        let mut current = slot.lock().unwrap_or_else(|error| error.into_inner());
        let Some(source) = reader.open(path) else {
            *current = None;
            return Ok(None);
        };
        let captured = match capture(source, current.as_deref()) {
            Ok(captured) => captured,
            Err(source) => return Err(InternalError::Io { source }.into()),
        };
        if let Some(captured) = captured {
            *current = Some(Arc::new(AssetVersion::new(captured)?));
        }
        Ok(current.as_ref().map(|version| SharedAsset {
            version: version.clone(),
            _capture: None,
        }))
    }
}

/// Return a fresh capture only when a byte or the length differs. The previous
/// capture supplies any prefix already confirmed equal, so Serve reads the source once.
fn capture(source: OpenedFile, current: Option<&AssetVersion>) -> io::Result<Option<OpenedFile>> {
    let mut reader = BufReader::with_capacity(CHUNK, source.file.take(source.length));
    let old = current.filter(|version| version.opened.length == source.length);
    let prefix = match old {
        Some(old) => equal_prefix(&mut reader, &old.opened)?,
        None => 0,
    };
    if old.is_some() && prefix == source.length {
        return Ok(None);
    }

    let mut file = tempfile::tempfile()?;
    if let Some(old) = old {
        io::copy(&mut AtOffset::new(&old.opened, 0).take(prefix), &mut file)?;
    }
    let count = io::copy(&mut reader, &mut file)?;
    Ok(Some(OpenedFile {
        file,
        length: prefix + count,
        content_type: source.content_type,
    }))
}

fn equal_prefix(reader: &mut BufReader<Take<File>>, old: &OpenedFile) -> io::Result<u64> {
    let mut previous = AtOffset::new(old, 0);
    let mut buffer = vec![0; CHUNK];
    let mut offset = 0;
    loop {
        let bytes = reader.fill_buf()?;
        let length = bytes.len();
        if length == 0 {
            return Ok(offset);
        }
        previous.read_exact(&mut buffer[..length])?;
        if bytes != &buffer[..length] {
            return Ok(offset);
        }
        offset += length as u64;
        reader.consume(length);
    }
}
