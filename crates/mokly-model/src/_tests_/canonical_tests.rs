//! Canonical byte and ordering tests.

use serde::Serialize;
use serde_json::json;

use super::{compare_utf16, to_string};
use crate::prop_schema::PropSchema;
use crate::typescript;
use crate::versions;

#[test]
fn canonical_bytes_use_utf16_and_preserve_authored_arrays() {
    let value = json!({
        "\u{e000}": { "z": [], "a": {} },
        "😀": null,
        "tags": ["z", "a"],
        "steps": [{"b": 2, "a": 1}, {}]
    });
    insta::assert_snapshot!(to_string(&value).unwrap());
    assert!(compare_utf16("😀", "\u{e000}").is_lt());
    let reversed = json!({"steps": [{"a": 1, "b": 2}, {}], "tags": ["z", "a"], "😀": null, "\u{e000}": {"a": {}, "z": []}});
    assert_eq!(to_string(&value).unwrap(), to_string(&reversed).unwrap());
}

#[test]
fn absent_optionals_stay_absent_and_null_constants_stay_present() {
    #[derive(Serialize)]
    struct Record {
        #[serde(skip_serializing_if = "Option::is_none")]
        absent: Option<String>,
        empty: Vec<String>,
    }
    assert_eq!(
        to_string(&Record {
            absent: None,
            empty: vec![]
        })
        .unwrap(),
        "{\n  \"empty\": []\n}\n"
    );
    let schema: PropSchema = serde_json::from_value(json!({"const": null})).unwrap();
    assert_eq!(
        serde_json::to_value(schema).unwrap(),
        json!({"const": null})
    );
}

#[test]
fn type_generation_and_versions_are_stable() {
    insta::assert_snapshot!(typescript::generate());
    assert_eq!(
        [
            versions::CATALOGUE_INDEX,
            versions::ENTRY_DETAIL,
            versions::REVIEW_RESULT,
            versions::CHANGE_SNAPSHOT,
            versions::LIVE_DESCRIPTOR
        ],
        [7, 2, 8, 4, 3]
    );
}
