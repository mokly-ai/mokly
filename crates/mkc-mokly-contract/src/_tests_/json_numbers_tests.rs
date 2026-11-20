//! JSON number spellings preserve JavaScript integer semantics at the seam.

use crate::error::{ArtifactKind, Error};
use crate::index::CatalogueIndex;
use crate::inventory::Inventory;
use crate::limits::Limits;
use crate::manifest::UploadManifest;

#[test]
fn integral_json_numbers_accept_decimal_and_exponent_spellings() {
    assert!(Inventory::parse(br#"{"schemaVersion":3.0,"files":[]}"#, Limits::default()).is_ok());
    let manifest = include_str!("../../fixtures/mokly-upload.json")
        .replace("\"schemaVersion\": 3", "\"schemaVersion\": 3e0")
        .replace("\"pullRequest\": null", "\"pullRequest\": 2.0");
    assert!(UploadManifest::parse(manifest.as_bytes(), Limits::default()).is_ok());
    let index = include_str!("../../fixtures/index-v9.json")
        .replace("\"schemaVersion\": 9", "\"schemaVersion\": 9.0");
    assert!(CatalogueIndex::parse(index.as_bytes(), Limits::default()).is_ok());
}

#[test]
fn fractional_and_negative_integer_fields_are_rejected() {
    for value in ["1.5", "-1", "1e100"] {
        let bytes = format!("{{\"schemaVersion\":{value},\"files\":[]}}");
        assert!(Inventory::parse(bytes.as_bytes(), Limits::default()).is_err());
    }
}

#[test]
fn every_artifact_reports_unsupported_versions_as_426() {
    let bytes = br#"{"schemaVersion":99,"futureBody":[]}"#;
    let limits = Limits::default();
    for error in [
        UploadManifest::parse(bytes, limits).unwrap_err(),
        Inventory::parse(bytes, limits).unwrap_err(),
        CatalogueIndex::parse(bytes, limits).unwrap_err(),
    ] {
        assert_eq!(error.status_code(), 426);
        assert_eq!(error.code(), "upload-unsupported-version");
    }
}

#[test]
fn every_present_wrong_version_keeps_its_artifact_kind() {
    for value in [
        "1",
        "4",
        "5",
        "99",
        "null",
        "true",
        "\"current\"",
        "[]",
        "{}",
    ] {
        let bytes = format!("{{\"schemaVersion\":{value},\"futureBody\":null}}");
        for (error, expected) in [
            (
                UploadManifest::parse(bytes.as_bytes(), Limits::default()).unwrap_err(),
                ArtifactKind::Envelope,
            ),
            (
                Inventory::parse(bytes.as_bytes(), Limits::default()).unwrap_err(),
                ArtifactKind::Inventory,
            ),
            (
                CatalogueIndex::parse(bytes.as_bytes(), Limits::default()).unwrap_err(),
                ArtifactKind::Index,
            ),
        ] {
            assert!(
                matches!(error, Error::UnsupportedVersion { artifact, .. } if artifact == expected),
                "{value}: {error:?}"
            );
            assert_eq!(error.status_code(), 426);
        }
    }
}
