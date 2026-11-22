//! Live authored reads retain validators while responses own their captures.

use std::collections::BTreeMap;
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};

use axum::http::{HeaderMap, HeaderValue};
use xxhash_rust::xxh3::Xxh3Default;

use crate::asset_file::{AtOffset, CaptureWriter, GzipMetadata, gzip_copy};
use crate::asset_streams::{AssetOwner, AssetVersion, GzipDelivery, SharedAsset};
use crate::error::{InternalError, Result};
use crate::json_delivery::Gzip;
use crate::public_read::{OpenedFile, PublicReader};
use crate::validator;

type RecordSlot = Arc<Mutex<Option<Arc<AuthoredRecord>>>>;

/// Retain one validator record per reached authored route in this generation.
#[derive(Default)]
pub(crate) struct AuthoredAssets(Mutex<BTreeMap<String, RecordSlot>>);

#[derive(Eq, PartialEq)]
struct Fingerprint {
    length: u64,
    xxh3: u128,
}

/// The identity and gzip validators of one version. No file lives in this record.
pub(crate) struct AuthoredRecord {
    fingerprint: Fingerprint,
    etag: HeaderValue,
    gzip: Mutex<Option<GzipMetadata>>,
}

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
        let hash_while_copying = current
            .as_ref()
            .is_none_or(|record| record.fingerprint.length != source.length);
        let (opened, fingerprint, tag) = capture(source, hash_while_copying)?;
        let record = match current.as_ref() {
            Some(record) if record.fingerprint == fingerprint => record.clone(),
            _ => {
                let etag = match tag {
                    Some(tag) => tag,
                    None => validator::reader(&mut AtOffset::new(&opened, 0))?,
                };
                let record = Arc::new(AuthoredRecord {
                    fingerprint,
                    etag,
                    gzip: Mutex::default(),
                });
                *current = Some(record.clone());
                record
            }
        };
        Ok(Some(SharedAsset {
            version: Arc::new(AssetVersion::with_tag(opened, record.etag.clone())),
            owner: AssetOwner::Authored(record),
        }))
    }
}

impl AuthoredRecord {
    /// Revalidate or encode one request's own gzip copy on a blocking thread.
    pub(crate) async fn gzip(
        self: &Arc<Self>,
        source: Arc<AssetVersion>,
        headers: &HeaderMap,
    ) -> Option<GzipDelivery> {
        let record = self.clone();
        let headers = headers.clone();
        Gzip::default()
            .get(move || record.encode(&source.opened, &headers))
            .await
    }

    fn encode(&self, source: &OpenedFile, headers: &HeaderMap) -> Result<GzipDelivery> {
        let known = {
            let mut metadata = self.gzip.lock().unwrap_or_else(|error| error.into_inner());
            match metadata.as_ref() {
                Some(known) => known.clone(),
                None => {
                    let (file, record) = gzip_copy(source, None)?;
                    *metadata = Some(record.clone());
                    return Ok(GzipDelivery::File(Arc::new(AssetVersion::with_tag(
                        file,
                        record.etag,
                    ))));
                }
            }
        };
        if validator::matches_tag(headers, &known.etag) {
            return Ok(GzipDelivery::Unchanged(known.etag));
        }
        let (file, record) = gzip_copy(source, Some(known))?;
        Ok(GzipDelivery::File(Arc::new(AssetVersion::with_tag(
            file,
            record.etag,
        ))))
    }
}

fn capture(
    source: OpenedFile,
    hash: bool,
) -> Result<(OpenedFile, Fingerprint, Option<HeaderValue>)> {
    let mut input = source.file.take(source.length);
    let (output, xxh3) = match copy_and_fingerprint(&mut input, hash) {
        Ok(captured) => captured,
        Err(source) => return Err(InternalError::Io { source }.into()),
    };
    let (file, tag) = output.finish(source.content_type)?;
    let fingerprint = Fingerprint {
        length: file.length,
        xxh3,
    };
    Ok((file, fingerprint, tag))
}

fn copy_and_fingerprint(input: &mut dyn Read, hash: bool) -> io::Result<(CaptureWriter, u128)> {
    let mut output = CaptureWriter::new(hash)?;
    let mut xxh3 = Xxh3Default::new();
    let mut buffer = vec![0; 64 * 1024];
    loop {
        let count = input.read(&mut buffer)?;
        if count == 0 {
            return Ok((output, xxh3.digest128()));
        }
        let bytes = &buffer[..count];
        output.write_all(bytes)?;
        xxh3.update(bytes);
    }
}
