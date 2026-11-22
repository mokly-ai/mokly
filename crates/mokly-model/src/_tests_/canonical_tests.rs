//! Canonical byte and ordering tests.

use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::error::{InternalError, ModelError};
use crate::prop_schema::PropSchema;
use crate::{typescript, versions};

use super::{compare_utf16, to_string};

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
fn every_object_sorts_by_utf16_at_every_depth_with_empties_and_number_spellings() {
    let value = json!({
        "z": {"b": [], "a": {}},
        "a\u{e000}": 1,
        "a😀": -1,
        "a": [{"y": true, "x": null}, [], [{}], [[{"d": 0, "c": 1}]]],
        "\u{ffff}": "max",
        "𝄞": "clef",
        "é": u64::MAX,
        "Z": i64::MIN,
        "ab": [0.1, -0.0, 1e-7, 2.5e300, 1.0],
        "\"quoted\\key\n": {},
        "": []
    });
    let expected = concat!(
        "{\n",
        "  \"\": [],\n",
        "  \"\\\"quoted\\\\key\\n\": {},\n",
        "  \"Z\": -9223372036854775808,\n",
        "  \"a\": [\n",
        "    {\n",
        "      \"x\": null,\n",
        "      \"y\": true\n",
        "    },\n",
        "    [],\n",
        "    [\n",
        "      {}\n",
        "    ],\n",
        "    [\n",
        "      [\n",
        "        {\n",
        "          \"c\": 1,\n",
        "          \"d\": 0\n",
        "        }\n",
        "      ]\n",
        "    ]\n",
        "  ],\n",
        "  \"ab\": [\n",
        "    0.1,\n",
        "    -0.0,\n",
        "    1e-7,\n",
        "    2.5e+300,\n",
        "    1.0\n",
        "  ],\n",
        "  \"a😀\": -1,\n",
        "  \"a\u{e000}\": 1,\n",
        "  \"z\": {\n",
        "    \"a\": {},\n",
        "    \"b\": []\n",
        "  },\n",
        "  \"é\": 18446744073709551615,\n",
        "  \"𝄞\": \"clef\",\n",
        "  \"\u{ffff}\": \"max\"\n",
        "}\n"
    );
    assert_eq!(to_string(&value).unwrap(), expected);
    assert_eq!(to_string(&json!({})).unwrap(), "{}\n");
    assert_eq!(to_string(&json!([])).unwrap(), "[]\n");
    assert_eq!(to_string(&json!([[], {}])).unwrap(), "[\n  [],\n  {}\n]\n");
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
            versions::DEPLOYMENT_FILE,
            versions::ENTRY_DETAIL,
            versions::REVIEW_RESULT,
            versions::CHANGE_SNAPSHOT,
            versions::LIVE_DESCRIPTOR
        ],
        [9, 1, 4, 8, 4, 3]
    );
}

#[test]
fn detail_id_ignores_its_own_id_and_current_revision() {
    let base = serde_json::json!({
        "schemaVersion": 4,
        "detailId": "0".repeat(64),
        "revision": 0,
        "entry": {"path": "home"},
    });
    let first = super::detail_id(&base).unwrap();
    let mut old_version = base.clone();
    old_version["schemaVersion"] = serde_json::json!(3);
    assert_ne!(first, super::detail_id(&old_version).unwrap());
    let mut changed_id = base.clone();
    changed_id["detailId"] = serde_json::json!("f".repeat(64));
    changed_id["revision"] = serde_json::json!(7);
    assert_eq!(first, super::detail_id(&changed_id).unwrap());
    changed_id["entry"]["path"] = serde_json::json!("other");
    assert_ne!(first, super::detail_id(&changed_id).unwrap());
}

#[test]
fn nested_canonical_preimages_preserve_numbers_escapes_arrays_and_unicode() {
    let value = json!({
        "revision": 0,
        "nested": {
            "\u{e000}": {},
            "😀": [],
            "text": "café\n\t\\\"detailId\\\":\\\"nested\\\"",
            "numbers": [0, -0.0, 1.5, 100.0, 1e16],
            "array": [{"revision": 9, "detailId": "nested"}, null, true]
        },
        "detailId": "0".repeat(64)
    });
    let expected = concat!(
        "{\n",
        "  \"detailId\": \"0000000000000000000000000000000000000000000000000000000000000000\",\n",
        "  \"nested\": {\n",
        "    \"array\": [\n",
        "      {\n",
        "        \"detailId\": \"nested\",\n",
        "        \"revision\": 9\n",
        "      },\n",
        "      null,\n",
        "      true\n",
        "    ],\n",
        "    \"numbers\": [\n",
        "      0,\n",
        "      -0.0,\n",
        "      1.5,\n",
        "      100.0,\n",
        "      1e+16\n",
        "    ],\n",
        "    \"text\": \"café\\n\\t\\\\\\\"detailId\\\\\\\":\\\\\\\"nested\\\\\\\"\",\n",
        "    \"😀\": [],\n",
        "    \"\u{e000}\": {}\n",
        "  },\n",
        "  \"revision\": 0\n",
        "}\n"
    );
    assert_eq!(to_string(&value).unwrap(), expected);
    assert_eq!(super::detail_preimage(&value).unwrap(), expected);
    let hash = |text: &str| {
        Sha256::digest(text)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    };
    assert_eq!(super::detail_id(&value).unwrap(), hash(expected));
    let mut changed = value.clone();
    changed["detailId"] = json!("f".repeat(64));
    changed["revision"] = json!(u64::MAX);
    assert_eq!(super::detail_id(&changed).unwrap(), hash(expected));
    changed.as_object_mut().unwrap().remove("revision");
    let absent = expected.replace(",\n  \"revision\": 0", "");
    assert_eq!(super::detail_id(&changed).unwrap(), hash(&absent));
    assert_ne!(hash(expected), hash(&absent));
    let ModelError::Internal(InternalError::Json { source }) =
        super::detail_id(&json!([])).unwrap_err()
    else {
        panic!("a non-object detail must retain its JSON error");
    };
    assert_eq!(
        source.io_error_kind(),
        Some(std::io::ErrorKind::InvalidData)
    );
    assert_eq!(source.to_string(), "detail must be an object");
}
