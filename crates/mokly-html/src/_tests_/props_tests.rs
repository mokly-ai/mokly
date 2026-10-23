//! Coercion and substitution keep schema member order and preserve data types.

use mokly_model::data::{DataValue, Props};
use mokly_model::prop_schema::PropSchema;
use serde_json::json;

use crate::props::{coerce, substitute};
use crate::{parse, serialize};

#[test]
fn scalar_coercion_covers_primitives_choices_unions_and_invalid_literals() {
    for (schema, literal, expected) in [
        (json!({"type":"string"}), "$literal", json!("$literal")),
        (json!({"type":"boolean"}), "", json!(true)),
        (json!({"type":"boolean"}), "false", json!(false)),
        (json!({"type":"integer"}), "3", json!(3)),
        (json!({"type":"number"}), "-0.5", json!(-0.5)),
        (json!({"type":"null"}), "null", json!(null)),
        (
            json!({"enum":[false,"primary"]}),
            "primary",
            json!("primary"),
        ),
        (json!({"const":null}), "null", json!(null)),
        (
            json!({"oneOf":[{"const":true},{"const":"secondary"}]}),
            "true",
            json!(true),
        ),
        (json!({"type":["boolean","string"]}), "false", json!(false)),
        (
            json!({"anyOf":[{"type":"integer","minimum":5},{"type":"string"}]}),
            "3",
            json!("3"),
        ),
        (
            json!({"type":["number","string"],"minimum":5}),
            "3",
            json!("3"),
        ),
        (
            json!({"anyOf":[{"type":"integer"},{"type":"string"}]}),
            "3",
            json!(3),
        ),
    ] {
        let schema: PropSchema = serde_json::from_value(schema).unwrap();
        assert_eq!(
            serde_json::to_value(coerce(&schema, literal).unwrap()).unwrap(),
            expected
        );
    }
    for (schema, literal) in [
        (json!({"type":"boolean"}), "yes"),
        (json!({"type":"integer"}), "1.2"),
        (json!({"type":"number"}), "01"),
        (json!({"type":"number"}), "Infinity"),
        (json!({"type":"array"}), "[]"),
        (json!({"type":"object"}), "{}"),
        (json!({"enum":["false",false]}), "false"),
    ] {
        assert!(coerce(&serde_json::from_value(schema).unwrap(), literal).is_none());
    }
}

#[test]
fn numeric_choices_return_binary64_values() {
    for schema in [
        json!({"enum":[9007199254740993_u64]}),
        json!({"const":9007199254740993_u64}),
        json!({"oneOf":[{"const":9007199254740993_u64}]}),
    ] {
        let schema: PropSchema = serde_json::from_value(schema).unwrap();
        let value = coerce(&schema, "9007199254740992").unwrap();
        assert_eq!(serde_json::to_string(&value).unwrap(), "9007199254740992.0");
    }
}

#[test]
fn substitutions_read_only_declared_scalars_and_leave_open_braces_literal() {
    let schema: PropSchema = serde_json::from_value(json!({"type":"object","properties":{"label":{"type":"string"},"optional":{"type":"string"},"badge":{"type":"object","properties":{"count":{"type":"integer"}}}}})).unwrap();
    let props: Props =
        serde_json::from_value(json!({"label":"<A & B>","badge":{"count":2}})).unwrap();
    assert_eq!(
        substitute(
            "{{label}}/{{badge.count}}/{{optional}}/{{open",
            &schema,
            &props
        )
        .unwrap(),
        "<A & B>/2//{{open"
    );
    assert!(substitute("{{missing}}", &schema, &props).is_err());
    assert!(substitute("{{badge}}", &schema, &props).is_err());
    assert_eq!(props["label"], DataValue::String("<A & B>".into()));
}

#[test]
fn html5_tree_building_repairs_tables_and_formatting_before_serialization() {
    let source = "<table><tr><td>A &amp; B</td></tr></table><p><b>one<i>two</b>three</i>";
    insta::assert_snapshot!(serialize::html(&parse::fragment(source)));
}
