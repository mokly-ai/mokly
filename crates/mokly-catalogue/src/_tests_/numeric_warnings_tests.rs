//! Unsafe schema integers retain precise pointers through nested schema shapes.

use serde_json::json;

use crate::numeric_warnings::schema_paths;

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
