//! Live edits validate the complete props and the installed view and revision.

use mokly_model::readers;
use serde_json::{Value, json};

use super::{Rejection, RenderRequest, validate};

fn request() -> RenderRequest {
    serde_json::from_value(json!({"entryPath":"components/action", "viewport":"mobile", "colorScheme":"light", "revision":1, "pageId":"a".repeat(32), "overrides":{"label":{"kind":"set","value":"Edited"}}})).unwrap()
}

#[test]
fn edit_unknown_prop_unset_view_and_revision_contracts() {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    index.revision = 1;
    let mut edit = request();
    assert_eq!(
        serde_json::to_value(validate(&edit, &index).unwrap().props).unwrap()["label"],
        "Edited"
    );
    edit.revision = 0;
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::StaleRevision
    );
    edit.revision = 1;
    edit.color_scheme = mokly_model::axes::ColorScheme::Dark;
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::InvalidInput
    );
    edit.color_scheme = mokly_model::axes::ColorScheme::Light;
    edit.entry_path = "absent".into();
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::UnknownEntry
    );
    edit = request();
    edit.overrides
        .insert("missing".into(), super::Override::Unset {});
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::InvalidInput
    );
    edit = request();
    edit.overrides
        .insert("label".into(), super::Override::Unset {});
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::InvalidInput
    );
    edit.overrides.insert(
        "label".into(),
        super::Override::Set {
            value: mokly_model::data::DataValue::Null,
        },
    );
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::InvalidInput
    );
}

#[test]
fn the_wire_boundary_rejects_unknown_fields_and_invalid_enums() {
    for body in [
        json!({"entryPath":"components/action", "module":"private.tsx"}),
        json!({"entryPath":"components/action","viewport":"wide","colorScheme":"light","revision":1,"pageId":"a".repeat(32),"overrides":{}}),
    ] {
        assert!(serde_json::from_value::<RenderRequest>(body).is_err());
    }
}

#[test]
fn unset_rejects_value_and_unknown_fields() {
    for extra in ["value", "unexpected"] {
        let edit = json!({"kind":"unset",extra:3});
        assert!(serde_json::from_value::<super::Override>(edit).is_err());
    }
    assert!(serde_json::from_value::<super::Override>(json!({"kind":"unset"})).is_ok());
}

#[test]
fn controls_cover_unicode_numbers_choices_null_optional_and_uneditable_props() {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    index.revision = 1;
    let visual = &mut index.components[0].visual;
    visual.prop_schema = serde_json::from_value(json!({
        "type":"object","additionalProperties":false,
        "properties":{
            "text":{"type":"string","maxLength":3},
            "enabled":{"type":"boolean"},
            "amount":{"type":"number","minimum":1.5,"maximum":6,"multipleOf":0.5},
            "choice":{"type":["string","null","number"],"enum":[null,"go",1]},
            "locked":{"type":"object","properties":{},"additionalProperties":false}
        },"required":["locked"]
    }))
    .unwrap();
    visual.controls = mokly_model::controls::derive(&visual.prop_schema);
    let props = serde_json::from_value(json!({"locked":{},"text":"old"})).unwrap();
    visual.props = mokly_model::wire_props::encode(&props);
    for (name, value, accepted) in [
        ("text", json!("😀😀😀"), true),
        ("text", json!("abcd"), false),
        ("enabled", json!(true), true),
        ("enabled", json!("true"), false),
        ("amount", json!(1.5), true),
        ("amount", json!(1.6), false),
        ("amount", json!(6.5), false),
        ("choice", Value::Null, true),
        ("choice", json!("go"), true),
        ("choice", json!(1.0), true),
        ("choice", json!("other"), false),
        ("locked", json!({}), false),
    ] {
        let mut edit = request();
        edit.overrides =
            serde_json::from_value(json!({name:{"kind":"set","value":value}})).unwrap();
        assert_eq!(validate(&edit, &index).is_ok(), accepted, "{name} {value}");
    }
    let mut edit = request();
    edit.overrides = serde_json::from_value(json!({"text":{"kind":"unset"}})).unwrap();
    let result = validate(&edit, &index).unwrap();
    assert!(!result.props.contains_key("text"));
    assert!(result.props.contains_key("locked"));
}

#[test]
fn complete_props_obey_control_bounds_even_when_the_prop_is_not_overridden() {
    let mut index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    index.revision = 1;
    let visual = &mut index.components[0].visual;
    visual.prop_schema = serde_json::from_value(json!({"type":"object","additionalProperties":false,"properties":{"label":{"type":"string"}},"required":["label"]})).unwrap();
    visual.controls =
        serde_json::from_value(json!({"label":{"kind":"text","maxLength":3}})).unwrap();
    visual.props =
        mokly_model::wire_props::encode(&serde_json::from_value(json!({"label":"Long"})).unwrap());
    let mut edit = request();
    edit.overrides.clear();
    assert_eq!(
        validate(&edit, &index).unwrap_err(),
        Rejection::InvalidInput
    );
    edit.overrides = serde_json::from_value(json!({"label":{"kind":"set","value":"Fit"}})).unwrap();
    assert!(validate(&edit, &index).is_ok());
}
