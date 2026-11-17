//! Real published-package artifact acceptance, independent of producer internals.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fs;
use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::Value;
use serde_json::value::RawValue;
use sha2::{Digest, Sha256};

use mkc_mokly_contract::archive::{GzipTarReader, TarballReader};
use mkc_mokly_contract::bundle::{ContractValidator, UploadValidator};
use mkc_mokly_contract::error::Error;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_mokly_contract::index_records::ChangesCount;
use mkc_mokly_contract::inventory::Inventory;
use mkc_mokly_contract::limits::Limits;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;

mod compatibility;

fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn reader() -> Arc<GzipTarReader> {
    Arc::new(GzipTarReader::new(Arc::new(
        ProcessUploadMemoryBudget::new(512 * 1024 * 1024),
    )))
}

#[test]
fn accepts_the_released_plan_and_its_complete_export() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures");
    let validator: Arc<dyn UploadValidator> = Arc::new(ContractValidator {
        reader: reader(),
        limits: Limits::default(),
    });
    let bundle = validator
        .validate(&mut fs::File::open(fixtures.join("plan.tar.gz")).unwrap())
        .unwrap();
    assert_eq!(bundle.manifest().mokly_version, "0.19.0");
    let index = bundle.index();
    assert_eq!(index.current_screens().len(), 2);
    assert_eq!(
        index.changes_count(),
        Some(ChangesCount {
            changed: 7,
            added: 0,
            removed: 0,
            moved: 0
        })
    );
    assert_eq!(
        index
            .counted_records()
            .iter()
            .map(|record| record.path.as_str())
            .collect::<Vec<_>>(),
        [
            "notice",
            "notice/draft",
            "notice/published",
            "guide",
            "page",
            "start",
            "publish"
        ]
    );
    assert_ne!(
        Some(bundle.manifest().head_sha.as_str()),
        index.base_commit()
    );
    assert_eq!(index.base(), Some("HEAD~1"));
    assert_eq!(
        bundle.artifacts()[0].bytes,
        fs::read(fixtures.join("mokly-upload.json")).unwrap()
    );
    assert!(fs::metadata(fixtures.join("plan.tar.gz")).unwrap().len() < 16 * 1024);

    let export = reader()
        .read(
            &mut fs::File::open(fixtures.join("dogfood.tar.gz")).unwrap(),
            Limits::default(),
        )
        .unwrap();
    assert!(fs::metadata(fixtures.join("dogfood.tar.gz")).unwrap().len() < 640 * 1024);
    let files = export.files();
    assert_eq!(files.len(), bundle.inventory().files.len() + 1);
    for declared in &bundle.inventory().files {
        let bytes = &files[&declared.path];
        assert_eq!(bytes.len() as u64, declared.size, "{}", declared.path);
        let digest: String = Sha256::digest(bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(digest, declared.sha256, "{}", declared.path);
    }
    assert_eq!(bundle.index_bytes(), &files[INDEX_PATH]);
    let detail: Value = serde_json::from_slice(&files["mokly-viewer/entries/notice.json"]).unwrap();
    assert!(
        detail["workspace"]["affected"]
            .as_array()
            .unwrap()
            .iter()
            .any(|record| record["entryPath"] == "finish")
    );
    assert!(
        detail["views"]
            .as_array()
            .unwrap()
            .iter()
            .any(|view| view["state"] == "changed")
    );
    assert!(
        detail["views"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|view| view["resourceEvidence"]["rules"].as_array().unwrap())
            .any(|rule| rule["status"] == "matched" && rule["selector"] == ".notice")
    );
}

#[test]
fn a_complete_export_is_not_a_plan() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures");
    let validator: Arc<dyn UploadValidator> = Arc::new(ContractValidator {
        reader: reader(),
        limits: Limits::default(),
    });
    let result = validator.validate(&mut fs::File::open(fixtures.join("dogfood.tar.gz")).unwrap());
    assert!(matches!(result, Err(Error::Invalid { .. })), "{result:?}");
}

#[test]
fn every_public_ownership_case_classifies_as_published() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures");
    let text = fs::read_to_string(fixtures.join("export-ownership-v3.json")).unwrap();
    let cases: Cases = serde_json::from_str(&text).unwrap();
    for case in cases.cases {
        let result = Inventory::parse(case.document.get().as_bytes(), Limits::default());
        let status = match case.rejection.as_deref() {
            None => None,
            Some("unsupported-version") => Some(426),
            Some("too-large") => Some(413),
            Some(_) => Some(400),
        };
        assert_eq!(
            result.as_ref().err().map(Error::status_code),
            status,
            "{}",
            case.name
        );
        assert_eq!(result.is_ok(), case.valid, "{}", case.name);
    }
}

#[derive(Deserialize)]
struct Cases<'a> {
    #[serde(borrow)]
    cases: Vec<Case<'a>>,
}

/// Raw documents keep cases such as a lone surrogate that no Rust string can hold.
#[derive(Deserialize)]
struct Case<'a> {
    name: String,
    valid: bool,
    rejection: Option<String>,
    #[serde(borrow)]
    document: &'a RawValue,
}
