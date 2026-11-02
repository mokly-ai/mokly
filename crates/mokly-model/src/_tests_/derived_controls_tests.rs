//! Derived selects keep authored order and omit repeated values.

use serde_json::json;

use crate::controls::derive;
use crate::data::DataValue;
use crate::prop_schema::PropSchema;
use crate::validation::accepts;

#[test]
fn enum_select_keeps_the_first_equal_numeric_value() {
    let schema: PropSchema = serde_json::from_value(json!({
        "properties": {"choice": {"enum": [1, 1.0, "1", true, "first", "first", 2]}}
    }))
    .unwrap();
    let controls = serde_json::to_value(derive(&schema)).unwrap();
    assert_eq!(
        controls["choice"]["options"],
        json!([
            {"label": "1", "value": 1},
            {"label": "1", "value": "1"},
            {"label": "true", "value": true},
            {"label": "first", "value": "first"},
            {"label": "2", "value": 2}
        ])
    );
}

#[test]
fn one_of_select_omits_values_that_match_several_members() {
    let property: PropSchema = serde_json::from_value(json!({
        "oneOf": [
            {"const": 1, "title": "First"},
            {"const": "unique", "title": "Unique"},
            {"const": 1.0, "title": "Repeated number"},
            {"const": "repeated", "title": "Repeated"},
            {"const": "repeated", "title": "Again"},
            {"const": null, "title": "None"}
        ]
    }))
    .unwrap();
    assert!(!accepts(&property, &DataValue::Number(1.into())));
    assert!(!accepts(&property, &DataValue::String("repeated".into())));
    assert!(accepts(&property, &DataValue::String("unique".into())));
    let schema = PropSchema {
        properties: Some([("choice".into(), property)].into()),
        ..Default::default()
    };
    let controls = serde_json::to_value(derive(&schema)).unwrap();
    assert_eq!(
        controls["choice"]["options"],
        json!([
            {"label": "Unique", "value": "unique"},
            {"label": "None", "value": null}
        ])
    );

    let schema: PropSchema = serde_json::from_value(json!({
        "properties": {"choice": {"oneOf": [{"const": 1}, {"const": 1.0}]}}
    }))
    .unwrap();
    assert_eq!(serde_json::to_value(derive(&schema)).unwrap(), json!({}));
}
