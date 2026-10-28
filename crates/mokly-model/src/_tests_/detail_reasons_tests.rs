//! The strict detail reader accepts review reason shapes without weakening its boundary.

use serde_json::{Value, json};

use crate::readers;

fn detail() -> Value {
    json!({"schemaVersion":3,"controlOrder":[],"identity":{"id":"a".repeat(64),"title":"Mokly"},
        "deploymentId":"b".repeat(64),"revision":0,
        "entry":{"path":"sample","kind":"component"},"views":[]})
}

#[test]
fn strict_reader_preserves_absent_empty_and_review_reason_records() {
    let mut value = detail();
    assert!(readers::detail(&value.to_string()).is_ok());
    for (kind, reasons) in [
        ("component", json!([])),
        ("component", json!([{ "kind": "implementation" }])),
        (
            "screen",
            json!([{ "kind": "dependency", "path": "static/theme.css" }, { "kind": "material" }]),
        ),
        (
            "use-case",
            json!([{ "kind": "screen", "screenPath": "home/variant" }]),
        ),
    ] {
        value["entry"]["kind"] = json!(kind);
        if kind == "use-case" {
            value.as_object_mut().unwrap().remove("controlOrder");
        }
        value["reasons"] = reasons;
        let read = readers::detail(&value.to_string()).unwrap();
        assert_eq!(serde_json::to_value(read).unwrap(), value);
    }
    value.as_object_mut().unwrap().remove("deploymentId");
    value.as_object_mut().unwrap().remove("revision");
    value["generation"] = json!("c".repeat(64));
    value["entry"]["snapshotId"] = json!("d".repeat(64));
    value["entry"]["kind"] = json!("component");
    value["controlOrder"] = json!([]);
    value["workspace"] = json!({"comparisonEligible":false,"usedBy":[],"affected":[],"relatedComponents":[],"inputChanges":[]});
    value["reasons"] = json!([{ "kind": "removed" }]);
    let read = readers::detail(&value.to_string()).unwrap();
    assert_eq!(serde_json::to_value(read).unwrap(), value);
}

#[test]
fn strict_reader_rejects_malformed_or_noncanonical_reasons() {
    for reasons in [
        json!(null),
        json!({ "kind": "material" }),
        json!(["material"]),
        json!([{ "kind": "unknown" }]),
        json!([{ "kind": "dependency" }]),
        json!([{ "kind": "dependency", "path": 1 }]),
        json!([{ "kind": "screen", "screen_path": "home" }]),
        json!([{ "kind": "material", "extra": true }]),
        json!([{ "kind": "material" }, { "kind": "dependency", "path": "static/a.css" }]),
        json!([{ "kind": "material" }, { "kind": "material" }]),
        json!([{ "kind": "dependency", "path": "static/\u{e000}.css" }, { "kind": "dependency", "path": "static/\u{10000}.css" }]),
    ] {
        let mut value = detail();
        value["reasons"] = reasons;
        assert!(readers::detail(&value.to_string()).is_err(), "{value}");
    }
}
