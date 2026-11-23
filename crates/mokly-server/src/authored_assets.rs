//! Live authored reads retain validators while responses own their captures.

use std::collections::BTreeMap;
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex, Weak};

use axum::http::{HeaderMap, HeaderValue};
use tokio::sync;
use xxhash_rust::xxh3::Xxh3Default;

use crate::asset_file::{AtOffset, CaptureWriter, GzipMetadata, gzip_copy};
use crate::asset_streams::{AssetOwner, AssetVersion, GzipDelivery, SharedAsset};
use crate::error::{InternalError, Result};
use crate::json_delivery::Gzip;
use crate::public_read::{OpenedFile, PublicReader};
use crate::validator::{self, Fingerprint};

type RecordSlot = Arc<Mutex<Option<Arc<AuthoredRecord>>>>;

/// Retain one validator record and a weak gate per reached authored route.
#[derive(Default)]
pub(crate) struct AuthoredAssets(Mutex<BTreeMap<String, Route>>);

#[derive(Default)]
struct Route {
    gate: Weak<sync::Mutex<()>>,
    record: RecordSlot,
}

/// Reservation for a fresh read of a reached authored route.
pub struct AuthoredRequest {
    gate: Arc<sync::Mutex<()>>,
    record: RecordSlot,
    path: String,
    reader: Arc<dyn PublicReader>,
}

/// The identity and gzip validators of one version. No file lives in this record.
pub(crate) struct AuthoredRecord {
    fingerprint: Fingerprint,
    etag: HeaderValue,
    gzip: Mutex<Option<GzipMetadata>>,
}

impl AuthoredAssets {
    /// Keep the route gate alive only while a request waits or reads.
    pub(crate) fn reserve(&self, path: String, reader: Arc<dyn PublicReader>) -> AuthoredRequest {
        let mut routes = self.0.lock().unwrap_or_else(|error| error.into_inner());
        let route = routes.entry(path.clone()).or_default();
        let gate = route.gate.upgrade().unwrap_or_else(|| {
            let gate = Arc::new(sync::Mutex::new(()));
            route.gate = Arc::downgrade(&gate);
            gate
        });
        AuthoredRequest {
            gate,
            record: route.record.clone(),
            path,
            reader,
        }
    }
}

impl AuthoredRequest {
    /// Hold the route through the blocking read, even if its HTTP request is cancelled.
    pub(crate) async fn admit(
        self,
    ) -> impl FnOnce() -> Result<Option<SharedAsset>> + Send + 'static {
        let guard = self.gate.lock_owned().await;
        move || {
            let _guard = guard;
            open(&self.record, &self.path, self.reader.as_ref())
        }
    }
}

fn open(slot: &RecordSlot, path: &str, reader: &dyn PublicReader) -> Result<Option<SharedAsset>> {
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
