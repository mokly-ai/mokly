//! Representative catalogue data and response decoding for compression tests.

use std::io::{Cursor, Read};
use std::sync::Arc;

use flate2::read::GzDecoder;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::stream::BlobStream;
use mkc_mokly_contract::archive::{GzipTarReader, TarballReader};
use mkc_mokly_contract::limits::Limits;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use serde_json::Value;

use crate::catalogue::{FileBody, FileFraming, Served};
use crate::test_support::body;

const FIVE_MIB: usize = 5 * 1024 * 1024;
const DOGFOOD_ARCHIVE: &[u8] =
    include_bytes!("../../../../mkc-mokly-contract/fixtures/dogfood.tar.gz");

pub(super) fn full_file(bytes: Arc<[u8]>, cache: &'static str) -> Served {
    let key = BlobKey::from_object_name(&format!(
        "sha256/{}/00000000-0000-7000-8000-000000000001",
        BlobHash::digest(bytes.as_ref())
    ))
    .unwrap();
    let stream = BlobStream::full(
        &key,
        bytes.len() as u64,
        body(bytes::Bytes::copy_from_slice(&bytes)),
    )
    .unwrap();
    Served::File {
        status: 200,
        body: Some(FileBody::Ready(stream)),
        framing: FileFraming::Full(bytes.len() as u64),
        content_type: "application/json".into(),
        cache,
        etag: format!("W/\"{}\"", BlobHash::digest(bytes.as_ref())),
        access_worker: false,
    }
}

pub(super) fn representative_catalogue_json() -> Arc<[u8]> {
    let archive = GzipTarReader::new(Arc::new(ProcessUploadMemoryBudget::new(512 * 1024 * 1024)))
        .read(&mut Cursor::new(DOGFOOD_ARCHIVE), Limits::default())
        .unwrap();
    let source: Value =
        serde_json::from_slice(archive.files().get("mokly-viewer/index.json").unwrap()).unwrap();
    let mut bytes = Vec::with_capacity(FIVE_MIB + 32 * 1024);
    bytes.extend_from_slice(br#"{"catalogues":["#);
    let mut copy = 0_u64;
    while bytes.len() < FIVE_MIB {
        if copy > 0 {
            bytes.push(b',');
        }
        let mut catalogue = source.clone();
        let mut field = 0_u64;
        vary_strings(&mut catalogue, copy, &mut field);
        serde_json::to_writer(&mut bytes, &catalogue).unwrap();
        copy += 1;
    }
    bytes.extend_from_slice(b"]}");
    assert!(bytes.len() >= FIVE_MIB);
    assert!(bytes.len() < FIVE_MIB + 64 * 1024);
    bytes.into()
}

pub(super) fn decode(encoding: &str, bytes: &[u8]) -> Vec<u8> {
    let mut decoded = Vec::new();
    match encoding {
        "br" => brotli::Decompressor::new(bytes, 64 * 1024)
            .read_to_end(&mut decoded)
            .unwrap(),
        "gzip" => GzDecoder::new(bytes).read_to_end(&mut decoded).unwrap(),
        other => panic!("unexpected content encoding: {other}"),
    };
    decoded
}

fn vary_strings(value: &mut Value, copy: u64, field: &mut u64) {
    match value {
        Value::Array(values) => {
            for value in values {
                vary_strings(value, copy, field);
            }
        }
        Value::Object(values) => {
            for value in values.values_mut() {
                vary_strings(value, copy, field);
            }
        }
        Value::String(value) => {
            value.push('~');
            value.push_str(&format!("{:016x}", variation(copy, *field)));
            *field += 1;
        }
        Value::Null | Value::Bool(_) | Value::Number(_) => {}
    }
}

fn variation(copy: u64, field: u64) -> u64 {
    let mut value = copy.wrapping_mul(0x9e37_79b9_7f4a_7c15).wrapping_add(field);
    value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    value ^ (value >> 31)
}
