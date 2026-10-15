//! The shared validator enforces narrowed bounds and choices for temporary props.

use std::collections::BTreeMap;

use serde_json::json;

use crate::controls::{ComponentControl, with_bounds};
use crate::diagnostic::{AuthoringKind, Context};
use crate::prop_schema::PropSchema;
use crate::validation::PropValidator;

#[test]
fn text_number_and_select_constraints_narrow_only_their_declared_props() {
    let schema: PropSchema = serde_json::from_value(json!({"type":"object","additionalProperties":false,"properties":{
        "label":{"type":"string"},"count":{"type":"number"},"choice":{"type":"string"},"fixed":{"type":"boolean"}
    },"required":["label","count","choice","fixed"]})).unwrap();
    let controls: BTreeMap<String, ComponentControl> = serde_json::from_value(json!({
        "label":{"kind":"text","maxLength":2},"count":{"kind":"number","minimum":2,"maximum":4,"step":2},"choice":{"kind":"select","options":[{"label":"A","value":"a"}]}
    })).unwrap();
    let narrowed = with_bounds(&schema, &controls);
    let context = Context {
        entry: "fixture".into(),
        variant: None,
        kind: AuthoringKind::JavaScript,
    };
    let validator =
        PropValidator::compile(&serde_json::to_value(narrowed).unwrap(), &context).unwrap();
    assert!(
        validator
            .validate(
                &json!({"label":"😀😀","count":2,"choice":"a","fixed":true}),
                &context
            )
            .is_ok()
    );
    for (name, value) in [
        ("label", json!("abc")),
        ("count", json!(0)),
        ("count", json!(6)),
        ("count", json!(3)),
        ("choice", json!("b")),
        ("fixed", json!(3)),
    ] {
        let mut props = json!({"label":"ok","count":2,"choice":"a","fixed":true});
        props[name] = value;
        assert!(validator.validate(&props, &context).is_err(), "{props}");
    }
}
