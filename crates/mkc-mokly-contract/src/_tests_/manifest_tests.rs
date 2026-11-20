//! Envelope grammar, required nulls, versions and rejection status contracts.

use serde_json::{Value, json};

use crate::error::{ArtifactKind, Error, Limit, Rejection};
use crate::limits::{Limits, Quotas};
use crate::manifest::UploadManifest;

fn valid() -> Value {
    json!({"schemaVersion":3,"moklyVersion":"0.9.0","repository":{"host":"github.com","owner":"mokly-ai","name":"mokly-cloud"},"branch":"feature/test","headSha":"a".repeat(40),"baseRef":null,"baseSha":null,"pullRequest":null,"configPath":"mokly.config.json","exportedAt":"2024-02-29T12:30:40.123Z"})
}

#[test]
fn nullable_fields_are_required_and_unknown_fields_are_rejected() {
    for key in valid().as_object().unwrap().keys() {
        let mut document = valid();
        document.as_object_mut().unwrap().remove(key);
        assert!(
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .is_err(),
            "missing {key}"
        );
    }
    for document in [
        json!({"future":1}),
        json!(null),
        json!([]),
        json!("manifest"),
    ] {
        assert!(
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .is_err()
        );
    }
    let mut document = valid();
    document["future"] = json!(true);
    assert!(matches!(
        UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::Json
        })
    ));
    let mut document = valid();
    document["repository"]["future"] = json!(true);
    assert!(
        UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()).is_err()
    );
}

#[test]
fn rejects_each_invalid_envelope_value() {
    for (field, value) in [
        ("moklyVersion", json!("latest")),
        ("moklyVersion", json!("01.0.0")),
        ("branch", json!("")),
        ("branch", json!("line\nfeed")),
        ("branch", json!("é".repeat(128))),
        ("headSha", json!("A".repeat(40))),
        ("headSha", json!("abc")),
        ("pullRequest", json!(0)),
        ("pullRequest", json!(9007199254740992_u64)),
        ("configPath", json!("../config.ts")),
        ("configPath", json!("a//b")),
        ("exportedAt", json!("2023-02-29T12:30:40.123Z")),
        ("exportedAt", json!("2024-01-01T00:00:00Z")),
        ("exportedAt", json!("2024-01-01T00:00:00.000+00:00")),
        ("exportedAt", json!("2024-01-01T00:00:60.000Z")),
        ("baseRef", json!("HEAD")),
        ("baseSha", json!("b".repeat(40))),
        ("comparisonPath", json!("review.json")),
    ] {
        let mut document = valid();
        document[field] = value;
        assert!(
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .is_err(),
            "accepted {field}: {document}"
        );
    }
}

#[test]
fn repository_identity_is_not_a_url_or_path() {
    for (field, value) in [
        ("host", "GitHub.com"),
        ("host", "host:443"),
        ("host", "-host"),
        ("host", "a..b"),
        ("owner", "../owner"),
        ("owner", ""),
        ("name", "a/b"),
        ("name", ".."),
        ("name", "@repo"),
    ] {
        let mut document = valid();
        document["repository"][field] = json!(value);
        assert!(
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .is_err(),
            "accepted {field}={value}"
        );
    }
}

#[test]
fn accepts_git_sha256_subgroups_and_semver_metadata() {
    let mut document = valid();
    document["repository"]["owner"] = json!("group/subgroup");
    document["headSha"] = json!("a".repeat(64));
    for producer in ["0.0.0", "0.18.1", "1.2.3-beta.1+build.2"] {
        document["moklyVersion"] = json!(producer);
        assert_eq!(
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .unwrap()
                .mokly_version,
            producer
        );
    }
}

#[test]
fn unsupported_envelope_version_is_426_and_limits_are_413() {
    let mut document = valid();
    for version in [0, 1, 2, 4, 99] {
        document["schemaVersion"] = json!(version);
        let error =
            UploadManifest::parse(&serde_json::to_vec(&document).unwrap(), Limits::default())
                .unwrap_err();
        assert!(
            matches!(error, Error::UnsupportedVersion { artifact: ArtifactKind::Envelope, version: Some(received) } if received == version)
        );
        assert_eq!(error.status_code(), 426);
    }
    let oversized = vec![b' '; 16 * 1024 + 1];
    assert!(matches!(
        UploadManifest::parse(&oversized, Limits::default()),
        Err(Error::TooLarge {
            limit: Limit::Manifest
        })
    ));
}

#[test]
fn probes_future_envelope_version_before_decoding_its_different_body() {
    let bytes = br#"{"schemaVersion":99,"publication":{"revision":"new-format"}}"#;
    let error = UploadManifest::parse(bytes, Limits::default()).unwrap_err();
    assert!(matches!(
        error,
        Error::UnsupportedVersion {
            version: Some(99),
            ..
        }
    ));
    assert_eq!(error.status_code(), 426);
}

#[test]
fn applies_lowered_envelope_and_config_path_quotas() {
    let bytes = serde_json::to_vec(&valid()).unwrap();
    for (limits, expected) in [
        (
            Limits::lowered(Quotas {
                manifest: bytes.len() as u64 - 1,
                ..Quotas::default()
            }),
            Limit::Manifest,
        ),
        (
            Limits::lowered(Quotas {
                path: 10,
                ..Quotas::default()
            }),
            Limit::Path,
        ),
        (
            Limits::lowered(Quotas {
                path_segments: 0,
                ..Quotas::default()
            }),
            Limit::PathSegments,
        ),
    ] {
        assert!(
            matches!(UploadManifest::parse(&bytes, limits), Err(Error::TooLarge { limit }) if limit == expected)
        );
    }
    assert!(
        UploadManifest::parse(
            &bytes,
            Limits::lowered(Quotas {
                manifest: bytes.len() as u64,
                ..Quotas::default()
            })
        )
        .is_ok()
    );
}

#[test]
fn standalone_envelope_also_obeys_the_regular_file_ceiling() {
    let bytes = serde_json::to_vec(&valid()).unwrap();
    let limits = Limits::lowered(Quotas {
        file: bytes.len() as u64 - 1,
        ..Quotas::default()
    });
    assert!(matches!(
        UploadManifest::parse(&bytes, limits),
        Err(Error::TooLarge { limit: Limit::File })
    ));
}

#[test]
fn duplicate_keys_and_bom_are_invalid_including_unknown_objects() {
    let original = serde_json::to_string(&valid()).unwrap();
    let duplicate = original.replacen('{', "{\"branch\":\"other\",", 1);
    assert!(matches!(
        UploadManifest::parse(duplicate.as_bytes(), Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::DuplicateJsonKey
        })
    ));
    let bom = [b"\xef\xbb\xbf".as_slice(), original.as_bytes()].concat();
    assert!(UploadManifest::parse(&bom, Limits::default()).is_err());
}
