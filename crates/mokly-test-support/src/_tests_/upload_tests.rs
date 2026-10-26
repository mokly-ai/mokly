use serde_json::{Value, json};

use crate::upload::{Rejection, metadata};

fn valid() -> Value {
    json!({
        "schemaVersion": 2,
        "moklyVersion": "1.2.3-rc.1",
        "repository": { "host": "example.com", "owner": "team/group", "name": "site" },
        "branch": "main",
        "headSha": "a".repeat(40),
        "baseRef": null,
        "baseSha": null,
        "pullRequest": 7,
        "configPath": "tools/mokly.config.json",
        "exportedAt": "2026-10-26T12:00:00.000Z",
        "comparisonPath": null,
    })
}

fn read(value: &Value) -> Result<(), Rejection> {
    metadata(value.to_string().as_bytes()).map(|_| ())
}

fn with(field: &str, replacement: Value) -> Value {
    let mut value = valid();
    value[field] = replacement;
    value
}

#[test]
fn valid_metadata_passes_and_each_broken_rule_is_rejected() {
    assert_eq!(read(&valid()), Ok(()));
    assert_eq!(
        read(&with("schemaVersion", json!(3))),
        Err(Rejection::UnsupportedVersion)
    );
    let mut missing = valid();
    missing.as_object_mut().unwrap().remove("schemaVersion");
    assert_eq!(read(&missing), Err(Rejection::Invalid));
    let invalid = [
        with("moklyVersion", json!("1.2.3-01")),
        with("exportedAt", json!("2026-02-30T12:00:00.000Z")),
        with("headSha", json!("A".repeat(40))),
        with("configPath", json!("../config.json")),
        with("pullRequest", json!(0)),
        with("baseRef", json!("main")),
        with(
            "repository",
            json!({ "host": "example.com", "owner": "team", "name": "a/b" }),
        ),
        with("comparisonPath", json!("mokly-viewer/diffs/review.json")),
    ];
    for value in invalid {
        assert_eq!(read(&value), Err(Rejection::Invalid), "{value}");
    }
    assert_eq!(
        metadata(&vec![b' '; 16_385]).map(|_| ()),
        Err(Rejection::TooLarge)
    );
}

#[test]
fn missing_fields_unicode_digits_and_leap_seconds_are_invalid_without_a_panic() {
    for field in ["moklyVersion", "pullRequest"] {
        let mut missing = valid();
        missing.as_object_mut().unwrap().remove(field);
        assert_eq!(read(&missing), Err(Rejection::Invalid), "{field}");
    }
    assert_eq!(
        read(&with("moklyVersion", json!("1\u{663}.2.3"))),
        Err(Rejection::Invalid)
    );
    assert_eq!(
        read(&with("exportedAt", json!("2026-12-31T23:59:60.000Z"))),
        Err(Rejection::Invalid)
    );
}
