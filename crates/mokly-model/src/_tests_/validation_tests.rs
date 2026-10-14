//! Profile enforcement and complete props validation.

use serde_json::{Value, json};

use crate::diagnostic::{AuthoringKind, Context};
use crate::error::ModelError;
use crate::validation::PropValidator;

fn context(kind: AuthoringKind) -> Context {
    Context {
        entry: "ui/button.mockup.tsx#Button".into(),
        variant: Some("disabled".into()),
        kind,
    }
}

fn schema(property: Value) -> Value {
    json!({"type": "object", "additionalProperties": false, "properties": {"value": property}})
}

#[test]
fn accepted_profile_checks_values_without_mutation() {
    let context = context(AuthoringKind::JavaScript);
    for (property, good, bad) in [
        (
            json!({"type":"string","minLength":1,"maxLength":3}),
            json!("yes"),
            json!("long"),
        ),
        (
            json!({"type":"number","minimum":0,"maximum":4,"multipleOf":0.5}),
            json!(1.5),
            json!(1.3),
        ),
        (json!({"type":"integer"}), json!(2), json!(2.5)),
        (json!({"type":"boolean"}), json!(true), json!("true")),
        (json!({"type":["null","string"]}), json!(null), json!(1)),
        (json!({"enum":["x",true,null,1]}), json!(true), json!(false)),
        (json!({"const":null}), json!(null), json!("null")),
        (
            json!({"oneOf":[{"const":"a","title":"A"},{"const":"b"}]}),
            json!("a"),
            json!("c"),
        ),
        (
            json!({"anyOf":[{"type":"number"},{"const":1}]}),
            json!(1),
            json!("1"),
        ),
        (
            json!({"type":"array","items":{"type":"boolean"},"minItems":1,"maxItems":2}),
            json!([true]),
            json!([1]),
        ),
        (
            json!({"type":"object","properties":{"x":{"type":"integer"}},"additionalProperties":false}),
            json!({"x":1}),
            json!({"y":1}),
        ),
    ] {
        let validator = PropValidator::compile(&schema(property), &context).unwrap();
        let props = json!({"value":good});
        let before = props.clone();
        validator.validate(&props, &context).unwrap();
        assert_eq!(before, props);
        assert!(validator.validate(&json!({"value":bad}), &context).is_err());
    }
}

#[test]
fn profile_rejects_unknown_keywords_placement_and_bad_bounds() {
    let context = context(AuthoringKind::JavaScript);
    for property in [
        json!({"type":"string","default":"x"}),
        json!({"type":"string","pattern":"x"}),
        json!({"$ref":"https://example.invalid/schema"}),
        json!({"type":"object"}),
        json!({"type":"string","minimum":0}),
        json!({"type":"number","maxLength":2}),
        json!({"type":"string","minLength":4,"maxLength":1}),
        json!({"type":"number","minimum":4,"maximum":1}),
        json!({"type":"array","minItems":4,"maxItems":1}),
        json!({"type":"number","minimum":-0.0}),
        json!({"type":"number","multipleOf":0}),
        json!({"type":"string","minLength":-1}),
        json!({"type":[]}),
        json!({"type":["string","string"]}),
        json!({"enum":[{}]}),
        json!({"const":[]}),
        json!({"oneOf":[{"type":"string"}]}),
        json!({"oneOf":[{"const":1,"description":"no"}]}),
        json!({"type":"object","additionalProperties":false,"required":["missing"]}),
        json!({"type":"object","additionalProperties":false,"properties":{"x":{"type":"null"}},"required":["x","x"]}),
        json!({"type":"string","$schema":"https://json-schema.org/draft/2020-12/schema"}),
        json!({}),
    ] {
        assert!(
            PropValidator::compile(&schema(property.clone()), &context).is_err(),
            "accepted {property}"
        );
    }
    assert!(
        PropValidator::compile(
            &json!({"type":["object","null"],"additionalProperties":false}),
            &context
        )
        .is_err()
    );
}

#[test]
fn diagnostics_preserve_kind_variant_and_exact_property_path() {
    for (kind, schema_code, props_code) in [
        (AuthoringKind::Html, "html-front-matter", "html-attribute"),
        (
            AuthoringKind::JavaScript,
            "component-schema",
            "component-props",
        ),
        (AuthoringKind::Story, "component-schema", "component-props"),
    ] {
        let context = context(kind);
        let ModelError::Schema(error) =
            PropValidator::compile(&schema(json!({"type":"string","pattern":"x"})), &context)
                .err()
                .unwrap()
        else {
            panic!()
        };
        assert_eq!(error.code.as_str(), schema_code);
        assert_eq!(error.path, "/properties/value/pattern");
        let validator = PropValidator::compile(
            &schema(json!({"type":"array","items":{"type":"integer"}})),
            &context,
        )
        .unwrap();
        let ModelError::Props(error) = validator
            .validate(&json!({"value":[1,"x"]}), &context)
            .unwrap_err()
        else {
            panic!()
        };
        assert_eq!(error.code.as_str(), props_code);
        assert_eq!(error.variant.as_deref(), Some("disabled"));
        assert_eq!(error.path, "/value/1");
        assert!(error.entry.ends_with("#Button"));
    }
}

#[test]
fn required_unknown_and_reserved_keys_have_exact_paths() {
    let context = context(AuthoringKind::JavaScript);
    let validator = PropValidator::compile(&json!({"type":"object","additionalProperties":false,"properties":{"value":{"type":"array"}},"required":["value"]}), &context).unwrap();
    for (props, path) in [
        (json!({}), "/value"),
        (json!({"value":[],"unknown":true}), "/unknown"),
        (json!({"value":[{"constructor":0}]}), "/value/0/constructor"),
    ] {
        let ModelError::Props(error) = validator.validate(&props, &context).unwrap_err() else {
            panic!()
        };
        assert_eq!(error.path, path);
    }
    validator
        .validate(&json!({"value":[null,{},[],true,-0.0]}), &context)
        .unwrap();
}

#[test]
fn traversal_limits_accept_the_boundary_and_reject_all_excess_data() {
    let context = context(AuthoringKind::JavaScript);
    let validator = PropValidator::compile(&schema(json!({"type":"array"})), &context).unwrap();
    validator
        .validate(&json!({"value":vec![0;9998]}), &context)
        .unwrap();
    assert!(
        validator
            .validate(&json!({"value":vec![0;9999]}), &context)
            .is_err()
    );
    let mut nested = json!(0);
    for _ in 0..63 {
        nested = json!([nested]);
    }
    validator
        .validate(&json!({"value":nested}), &context)
        .unwrap();
    let mut nested = json!(0);
    for _ in 0..64 {
        nested = json!([nested]);
    }
    assert!(
        validator
            .validate(&json!({"value":nested}), &context)
            .is_err()
    );
    assert!(PropValidator::compile(&schema(json!({"enum":vec![0;10001]})), &context).is_err());
}

#[test]
fn schema_numbers_keep_their_exact_json_values() {
    let context = context(AuthoringKind::JavaScript);
    for property in [
        json!({"const":9007199254740993u64}),
        json!({"type":"integer","minimum":9007199254740993u64,"maximum":18446744073709551615u64}),
        json!({"type":"string","minLength":1.0}),
    ] {
        let original = schema(property);
        let validator = PropValidator::compile(&original, &context).unwrap();
        assert_eq!(serde_json::to_value(validator.schema()).unwrap(), original);
    }
    assert!(PropValidator::compile(&schema(json!({"type":"integer","minimum":9007199254740993u64,"maximum":9007199254740992u64})), &context).is_err());
}
