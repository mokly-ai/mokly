//! The reservation attaches the full content type to each publication path.

use std::collections::HashMap;
use std::io::{Read, empty};
use std::sync::Arc;

use mkc_domain::blob::BlobHash;
use mkc_mokly_contract::archive::{ArchiveFiles, TarballReader};
use mkc_mokly_contract::bundle::{ContractValidator, PlanBundle, UploadValidator};
use mkc_mokly_contract::error::Result;
use mkc_mokly_contract::inventory::MARKER_PATH;
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_mokly_contract::scanned_archive::ScannedArchive;
use serde_json::{Value, json};

use super::{bundle, distinct_hashes, harness, reserve};

const IMAGE: &str = "static/mokly-generated/assets/photo.pjp";
const TEXT: &str = "static/notice.txt";

struct PlanArchive(ArchiveFiles);

impl TarballReader for PlanArchive {
    fn read(&self, _source: &mut dyn Read, limits: Limits) -> Result<ScannedArchive> {
        ScannedArchive::from_files(self.0.clone(), limits)
    }

    fn read_with_envelope(
        &self,
        source: &mut dyn Read,
        limits: Limits,
        _envelope: &mut Option<UploadManifest>,
    ) -> Result<ScannedArchive> {
        self.read(source, limits)
    }
}

fn bundle_with_assets() -> PlanBundle {
    let mut files: ArchiveFiles = bundle()
        .artifacts()
        .into_iter()
        .map(|artifact| (artifact.path, artifact.bytes))
        .collect();
    let marker = files.get_mut(MARKER_PATH).unwrap();
    let mut inventory: Value = serde_json::from_slice(marker).unwrap();
    let entries = inventory["files"].as_array_mut().unwrap();
    for (path, bytes) in [(IMAGE, &b"image"[..]), (TEXT, &b"text"[..])] {
        entries.push(json!({
            "path": path,
            "sha256": BlobHash::digest(bytes).to_string(),
            "size": bytes.len(),
        }));
    }
    *marker = serde_json::to_vec(&inventory).unwrap().into();
    ContractValidator {
        reader: Arc::new(PlanArchive(files)),
        limits: Limits::default(),
    }
    .validate(&mut empty())
    .unwrap()
}

#[test]
fn reservation_stores_declared_types_and_charset_parameters() {
    let bundle = bundle_with_assets();
    let harness = harness(HashMap::new(), distinct_hashes(&bundle).len(), 1);
    reserve(&harness, &bundle);

    let attached = harness.attached.lock().unwrap();
    for (path, expected) in [
        (IMAGE, "image/jpeg"),
        (TEXT, "text/plain; charset=utf-8"),
        ("index.html", "text/html; charset=utf-8"),
        ("mokly-viewer/index.json", "application/json; charset=utf-8"),
    ] {
        let stored = attached.iter().find(|file| file.path == path);
        assert_eq!(
            stored.map(|file| file.content_type.as_str()),
            Some(expected),
            "{path}"
        );
    }
}
