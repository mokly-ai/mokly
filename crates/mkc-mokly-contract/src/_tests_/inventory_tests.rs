//! Ownership schema 3 classification follows the published fixture cases.

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::{Value, json};

use crate::error::{ArtifactKind, Error, Limit, Rejection};
use crate::inventory::Inventory;
use crate::limits::{Limits, Quotas};

const DIGEST: &str = "555c566233e7163447a2eff77fe967453cadc5c70d64e87948a0fddc97169853";

fn marker(files: Value) -> Vec<u8> {
    serde_json::to_vec(&json!({"schemaVersion": 3, "files": files})).unwrap()
}

fn entry(path: &str, size: Value) -> Value {
    json!({"path": path, "sha256": DIGEST, "size": size})
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Fixture<'a> {
    schema_version: u64,
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

#[test]
fn published_ownership_cases_classify_exactly() {
    let fixture: Fixture =
        serde_json::from_str(include_str!("../../fixtures/export-ownership-v3.json")).unwrap();
    assert_eq!(fixture.schema_version, 1);
    assert!(fixture.cases.len() > 50);
    for case in &fixture.cases {
        let name = &case.name;
        let result = Inventory::parse(case.document.get().as_bytes(), Limits::default());
        match (case.valid, case.rejection.as_deref()) {
            (true, None) => assert!(result.is_ok(), "{name}: {result:?}"),
            (false, Some("unsupported-version")) => assert!(
                matches!(
                    result,
                    Err(Error::UnsupportedVersion {
                        artifact: ArtifactKind::Inventory,
                        ..
                    })
                ),
                "{name}: {result:?}"
            ),
            (false, Some("too-large")) => assert!(
                matches!(result, Err(Error::TooLarge { .. })),
                "{name}: {result:?}"
            ),
            (false, Some("invalid")) => assert!(
                matches!(result, Err(Error::Invalid { .. })),
                "{name}: {result:?}"
            ),
            other => panic!("{name}: unexpected fixture classification {other:?}"),
        }
    }
}

#[test]
fn version_is_classified_before_entries_and_reports_integers_only() {
    for (document, version) in [
        (
            json!({"schemaVersion": 1, "files": ["index.html"]}),
            Some(1),
        ),
        (json!({"schemaVersion": "3", "files": []}), None),
        (json!({"schemaVersion": 2, "files": [null]}), Some(2)),
        (json!({"schemaVersion": 3.5, "files": [null]}), None),
    ] {
        let result = Inventory::parse(&serde_json::to_vec(&document).unwrap(), Limits::default());
        assert!(
            matches!(
                result,
                Err(Error::UnsupportedVersion {
                    artifact: ArtifactKind::Inventory,
                    version: received,
                }) if received == version
            ),
            "{document}: {result:?}"
        );
    }
    assert!(Inventory::parse(br#"{"schemaVersion":3.0,"files":[]}"#, Limits::default()).is_ok());
    assert!(matches!(
        Inventory::parse(br#"{"files":[]}"#, Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::Inventory
        })
    ));
}

#[test]
fn entries_classify_in_source_order_before_namespace_checks() {
    let files = json!([
        entry("index.html", json!(-1)),
        entry("large.bin", json!(67_108_865)),
    ]);
    assert!(matches!(
        Inventory::parse(&marker(files), Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::Inventory
        })
    ));
    let long = "a".repeat(1025);
    let files = json!([entry("../bad", json!(1)), entry(&long, json!(1))]);
    assert!(matches!(
        Inventory::parse(&marker(files), Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::Path
        })
    ));
    for size in [json!(1e30), json!(67_108_865.0)] {
        assert!(matches!(
            Inventory::parse(&marker(json!([entry("a", size)])), Limits::default()),
            Err(Error::TooLarge { limit: Limit::File })
        ));
    }
    for size in [json!(-1), json!(1.5), json!("1")] {
        assert!(matches!(
            Inventory::parse(&marker(json!([entry("a", size)])), Limits::default()),
            Err(Error::Invalid { .. })
        ));
    }
    let parsed = Inventory::parse(&marker(json!([entry("a", json!(4e1))])), Limits::default());
    assert_eq!(parsed.unwrap().files[0].size, 40);
}

#[test]
fn entry_count_counts_the_marker() {
    let limits = Limits::lowered(Quotas {
        files: 3,
        ..Quotas::default()
    });
    let two = json!([entry("a", json!(1)), entry("b", json!(1))]);
    assert!(Inventory::parse(&marker(two), limits).is_ok());
    let three = json!([
        entry("a", json!(1)),
        entry("b", json!(1)),
        entry("c", json!(1))
    ]);
    assert!(matches!(
        Inventory::parse(&marker(three), limits),
        Err(Error::TooLarge {
            limit: Limit::FileCount
        })
    ));
}

#[test]
fn lowered_quotas_apply_to_the_marker_bytes_paths_and_prefixes() {
    let bytes = marker(json!([entry("a/b", json!(1))]));
    for (quotas, expected) in [
        (
            Quotas {
                inventory: bytes.len() as u64 - 1,
                ..Quotas::default()
            },
            Limit::Inventory,
        ),
        (
            Quotas {
                path_segments: 1,
                ..Quotas::default()
            },
            Limit::PathSegments,
        ),
        (
            Quotas {
                prefixes: 2,
                ..Quotas::default()
            },
            Limit::PrefixCount,
        ),
    ] {
        let result = Inventory::parse(&bytes, Limits::lowered(quotas));
        assert!(
            matches!(result, Err(Error::TooLarge { limit }) if limit == expected),
            "{expected:?}: {result:?}"
        );
    }
}

#[test]
fn unknown_fields_are_ignored_but_duplicate_keys_are_not() {
    let bytes = br#"{"schemaVersion":3,"files":[],"future":{"files":["../unowned"]}}"#;
    assert!(Inventory::parse(bytes, Limits::default()).is_ok());
    let bytes = br#"{"schemaVersion":3,"files":[],"future":{"x":1,"x":2}}"#;
    assert!(matches!(
        Inventory::parse(bytes, Limits::default()),
        Err(Error::Invalid {
            reason: Rejection::DuplicateJsonKey
        })
    ));
}

#[test]
fn entries_keep_their_declared_identity_and_lookup_is_exact() {
    let inventory = Inventory::parse(
        &marker(json!([entry("Index.html", json!(3)), entry("b", json!(0))])),
        Limits::default(),
    )
    .unwrap();
    let file = inventory.entry("Index.html").unwrap();
    assert_eq!((file.sha256.as_str(), file.size), (DIGEST, 3));
    assert!(inventory.entry("index.html").is_none());
}

#[test]
fn directory_spellings_may_differ_without_file_collisions() {
    let accepted = marker(json!([entry("A/x", json!(1)), entry("a/y", json!(1))]));
    assert!(Inventory::parse(&accepted, Limits::default()).is_ok());
    for files in [
        json!([entry("A/x", json!(1)), entry("a/X", json!(1))]),
        json!([entry("A", json!(1)), entry("a/y", json!(1))]),
        json!([entry("A/x", json!(1)), entry("a", json!(1))]),
    ] {
        assert_eq!(
            Inventory::parse(&marker(files), Limits::default())
                .unwrap_err()
                .status_code(),
            400
        );
    }
}

#[test]
fn non_integer_sizes_fail_before_limits_in_the_same_entry() {
    let files = json!([entry(&"a".repeat(1025), json!(1.5))]);
    assert_eq!(
        Inventory::parse(&marker(files), Limits::default())
            .unwrap_err()
            .status_code(),
        400
    );
}

#[test]
fn listing_the_marker_itself_fails_before_a_later_limit() {
    let files = json!([
        entry(".mokly-export-artifact", json!(1)),
        entry("big.bin", json!(67_108_865)),
    ]);
    assert_eq!(
        Inventory::parse(&marker(files), Limits::default())
            .unwrap_err()
            .status_code(),
        400
    );
    let first_over_limit = marker(json!([entry(".mokly-export-artifact", json!(67_108_865))]));
    assert_eq!(
        Inventory::parse(&first_over_limit, Limits::default())
            .unwrap_err()
            .status_code(),
        413
    );
}
