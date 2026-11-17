//! Both harnesses check the same corpus bytes before reading Changes counts.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use serde::Deserialize;

use mkc_mokly_contract::index::CatalogueIndex;
use mkc_mokly_contract::index_records::ChangesCount;
use mkc_mokly_contract::limits::Limits;

use super::super::digest;
use super::corpus::model::{Corpus, Rejection};
use super::corpus::render::document;

#[derive(Deserialize)]
struct Package {
    version: String,
}

#[derive(Deserialize)]
struct Checksums {
    files: BTreeMap<String, String>,
}

fn installed_version(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join(format!("../../ts/node_modules/@mokly/{name}/package.json"));
    let package: Package = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
    package.version
}

#[test]
fn every_shared_index_case_has_the_documented_counts_or_rejection() {
    let corpus: Corpus =
        serde_json::from_slice(include_bytes!("../../fixtures/index-v9-cases.json")).unwrap();
    assert_eq!(corpus.schema_version, 1);
    assert_eq!(corpus.mokly_version, installed_version("mokly"));
    assert_eq!(corpus.viewer_version, installed_version("viewer"));
    let mut names = BTreeSet::new();
    let mut accepted = 0;
    let mut refused = 0;
    for case in corpus.cases {
        assert!(names.insert(case.name.clone()), "{}", case.name);
        assert_ne!(
            case.counts.is_some(),
            case.cloud_rejection.is_some(),
            "{}",
            case.name
        );
        assert_eq!(
            case.viewer_valid.is_some(),
            case.cloud_rejection.is_some(),
            "{}",
            case.name
        );
        let bytes = document(&corpus.base_document, &case);
        let digest = digest(bytes.as_bytes());
        assert_eq!(
            digest, case.document_sha256,
            "{}: corpus input bytes differ",
            case.name
        );
        let result = CatalogueIndex::parse(bytes.as_bytes(), Limits::default());
        let expected = case.counts.map(|counts| ChangesCount {
            changed: counts.changed,
            added: counts.added,
            removed: counts.removed,
            moved: counts.moved,
        });
        assert_eq!(
            result
                .as_ref()
                .ok()
                .map(|index| index.changes_count().unwrap_or_default()),
            expected,
            "{}: {result:?}",
            case.name
        );
        let expected_status = case.cloud_rejection.map(|rejection| match rejection {
            Rejection::Invalid => (400, "upload-invalid-bundle"),
            Rejection::UnsupportedVersion => (426, "upload-unsupported-version"),
        });
        assert_eq!(
            result
                .as_ref()
                .err()
                .map(|error| (error.status_code(), error.code())),
            expected_status,
            "{}: {result:?}",
            case.name
        );
        accepted += usize::from(expected.is_some());
        refused += usize::from(expected_status.is_some());
    }
    assert_eq!((accepted, refused), (14, 60));
}

#[test]
fn real_producer_indexes_and_the_published_catalogue_have_the_documented_counts() {
    let original: Checksums =
        serde_json::from_slice(include_bytes!("../../fixtures/checksums.json")).unwrap();
    let moves: Checksums =
        serde_json::from_slice(include_bytes!("../../fixtures/moves-checksums.json")).unwrap();
    let hashes: BTreeMap<_, _> = original.files.into_iter().chain(moves.files).collect();
    for (name, bytes, expected) in [
        (
            "index-v9.json",
            include_bytes!("../../fixtures/index-v9.json").as_slice(),
            ChangesCount {
                changed: 7,
                added: 0,
                removed: 0,
                moved: 0,
            },
        ),
        (
            "moves-index-v9.json",
            include_bytes!("../../fixtures/moves-index-v9.json").as_slice(),
            ChangesCount {
                changed: 9,
                added: 5,
                removed: 8,
                moved: 5,
            },
        ),
        (
            "catalogue-v9.json",
            include_bytes!("../../fixtures/catalogue-v9.json").as_slice(),
            ChangesCount {
                changed: 2,
                added: 1,
                removed: 2,
                moved: 1,
            },
        ),
    ] {
        assert_eq!(digest(bytes), hashes[name], "{name}: input bytes differ");
        let index = CatalogueIndex::parse(bytes, Limits::default()).unwrap();
        assert_eq!(index.changes_count(), Some(expected), "{name}");
        assert_eq!(
            index.counted_records().len() as u64,
            expected.total(),
            "{name}"
        );
    }
}
