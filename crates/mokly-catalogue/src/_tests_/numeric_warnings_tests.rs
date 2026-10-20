//! Unsafe schema integers retain precise pointers through nested schema shapes.

use serde_json::json;

use mokly_model::catalogue::ModelEntry;

use crate::diagnostic::normalize_warnings;
use crate::numeric_warnings::{for_controls, schema_paths};

#[test]
fn nested_schema_keywords_warn_while_safe_numbers_and_annotations_do_not() {
    let schema = serde_json::from_value(json!({
        "type": "object",
        "properties": {
            "a/b~c": {"type": "array", "maxItems": 9007199254740993_u64,
                "items": {"anyOf": [
                    {"type": "string", "maxLength": 9007199254740993_u64},
                    {"enum": [9007199254740993_u64, 9007199254740991_u64]},
                    {"const": -9007199254740993_i64},
                    {"oneOf": [{"const": 9007199254740993_u64}]}
                ]}},
            "safe": {"type": "number", "minimum": -9007199254740991_i64,
                "maximum": 9007199254740991_u64, "multipleOf": 0.5,
                "title": "9007199254740993"}
        }
    }))
    .unwrap();
    assert_eq!(
        schema_paths(&schema),
        [
            "/properties/a~1b~0c/items/anyOf/0/maxLength",
            "/properties/a~1b~0c/items/anyOf/1/enum/0",
            "/properties/a~1b~0c/items/anyOf/2/const",
            "/properties/a~1b~0c/items/anyOf/3/oneOf/0/const",
            "/properties/a~1b~0c/maxItems",
        ]
    );
}

#[test]
fn control_warnings_keep_code_escaped_pointers_and_exact_duplicate_identity() {
    let controls = serde_json::from_value(json!({
        "a/b~c": {"kind":"number", "minimum":-9007199254740993_i64,
            "maximum":9007199254740993_u64,"step":9007199254740993_u64},
        "choice": {"kind":"select","options":[
            {"label":"9007199254740993","value":"9007199254740993"},
            {"label":"Large","value":9007199254740993_u64}]},
        "length": {"kind":"text","maxLength":9007199254740993_u64},
        "safe": {"kind":"number","minimum":-9007199254740991_i64,
            "maximum":9007199254740991_u64,"step":0.5},
        "boolean": {"kind":"boolean"}
    }))
    .unwrap();
    let entry: ModelEntry = serde_json::from_value(json!({
        "metadata":{"path":"number","title":"Number","description":"",
            "tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,
            "source":{"path":"number.mockup.ts","line":1,"column":1}},
        "content":{"kind":"screen","visual":{"colorSchemes":["light"],
            "propSchema":{"type":"object","additionalProperties":false},
            "props":{},"controls":{},"controlOrder":[]},"useCasePaths":[]}
    }))
    .unwrap();
    let mut warnings = for_controls(&controls, &entry);
    warnings.extend(for_controls(&controls, &entry));
    normalize_warnings(&mut warnings);
    assert_eq!(warnings.len(), 5);
    for (warning, path) in warnings.iter().zip([
        "/a~1b~0c/maximum",
        "/a~1b~0c/minimum",
        "/a~1b~0c/step",
        "/choice/options/1/value",
        "/length/maxLength",
    ]) {
        assert_eq!(warning.code, "props-unsafe-integer");
        assert_eq!(warning.printed_subject(), "entry \"number\"");
        assert_eq!(
            warning.message,
            format!(
                "control {path:?} is outside the JavaScript safe integer range and uses the nearest binary64 value"
            )
        );
    }
}
