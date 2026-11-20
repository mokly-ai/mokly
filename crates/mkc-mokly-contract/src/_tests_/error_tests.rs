//! Every public error category has a pinned HTTP status and CLI code.

use std::io;

use crate::error::{ArtifactKind, Error, ErrorResultExt, Limit, Rejection};
use crate::index::CatalogueIndex;
use crate::inventory::Inventory;
use crate::limits::Limits;
use crate::manifest::UploadManifest;

#[test]
fn error_status_and_code_table() {
    let internal = Err::<(), _>(io::Error::other("test failure"))
        .context("test internal mapping")
        .unwrap_err();
    for (error, status, code) in [
        (
            Error::UnsupportedVersion {
                artifact: ArtifactKind::Envelope,
                version: Some(99),
            },
            426,
            "upload-unsupported-version",
        ),
        (
            Error::TooLarge {
                limit: Limit::JsonNodes,
            },
            413,
            "upload-too-large",
        ),
        (
            Error::Invalid {
                reason: Rejection::Json,
            },
            400,
            "upload-invalid-bundle",
        ),
        (Error::Unavailable, 503, "upload-unavailable"),
        (internal, 500, "upload-failed"),
    ] {
        assert_eq!(error.status_code(), status);
        assert_eq!(error.code(), code);
    }
}

#[test]
fn unsupported_versions_name_each_artifact() {
    let bytes = br#"{"schemaVersion":99,"future":[]}"#;
    let limits = Limits::default();
    for (error, expected) in [
        (
            UploadManifest::parse(bytes, limits).unwrap_err(),
            ArtifactKind::Envelope,
        ),
        (
            Inventory::parse(bytes, limits).unwrap_err(),
            ArtifactKind::Inventory,
        ),
        (
            CatalogueIndex::parse(bytes, limits).unwrap_err(),
            ArtifactKind::Index,
        ),
    ] {
        assert!(
            matches!(error, Error::UnsupportedVersion { artifact, version: Some(99) } if artifact == expected)
        );
        assert_eq!(error.status_code(), 426);
        assert_eq!(error.code(), "upload-unsupported-version");
    }
}
