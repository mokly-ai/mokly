//! Receiver readers retain known content and ignore additive record fields.

use serde_json::{Value, json};

use crate::read_contract::ContractViolation;
use crate::readers::reader_fixtures;
use crate::readers::{self, ReadError};

#[test]
fn lenient_index_ignores_additive_fields_at_every_record_depth() {
    let value = reader_fixtures::index();
    let expected = value.clone();
    let mut extended = value;
    reader_fixtures::extend(&mut extended);
    let result = readers::index_lenient(&extended.to_string());
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), expected);
}

#[test]
fn lenient_details_ignore_additive_fields_in_current_and_historical_records() {
    for value in reader_fixtures::details() {
        let expected = value.clone();
        let mut extended = value;
        reader_fixtures::extend(&mut extended);
        if let Some(before) = extended.get_mut("before") {
            before["later"] = json!(1);
        }
        let result = readers::detail_lenient(&extended.to_string());
        assert!(result.is_ok(), "{}: {result:?}", extended["entry"]["path"]);
        assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), expected);
    }
}

#[test]
fn strict_readers_report_unknown_fields_after_typed_decoding() {
    for pointer in [
        "",
        "/identity",
        "/components/0",
        "/components/0/details",
        "/components/0/controls/label",
        "/components/0/controls/tone/options/0",
        "/tree/0",
        "/useCases/0/steps/0",
        "/live",
    ] {
        let mut value = reader_fixtures::index();
        value.pointer_mut(pointer).unwrap()["later"] = json!(1);
        assert!(
            matches!(
                readers::index(&value.to_string()),
                Err(ReadError::Contract {
                    boundary: "catalogue index",
                    message: ContractViolation::UnknownField
                })
            ),
            "{pointer}"
        );
    }
    for pointer in [
        "",
        "/entry",
        "/before",
        "/views/0/usage",
        "/views/0/usage/instances/0",
        "/views/0/usage/instances/0/source",
        "/views/0/resourceEvidence/rules/0/owner",
        "/reasons/0",
        "/workspace",
    ] {
        let mut value = reader_fixtures::detail("product/browse/home");
        value.pointer_mut(pointer).unwrap()["later"] = json!(1);
        assert!(
            matches!(
                readers::detail(&value.to_string()),
                Err(ReadError::Contract {
                    boundary: "entry detail",
                    message: ContractViolation::UnknownField
                })
            ),
            "{pointer}"
        );
    }
}

#[test]
fn lenient_readers_keep_schema_props_and_known_field_checks() {
    let mut value = reader_fixtures::index();
    value["components"][0]["controls"]["label"]["kind"] = json!("color");
    assert!(matches!(
        readers::index_lenient(&value.to_string()),
        Err(ReadError::Invalid { .. })
    ));
    let mut value = reader_fixtures::index();
    value["components"][0]["propSchema"]["later"] = json!(1);
    assert!(matches!(
        readers::index_lenient(&value.to_string()),
        Err(ReadError::Invalid { .. })
    ));
    let mut value = reader_fixtures::index();
    value["components"][0]["props"]["extra"] = json!(["boolean", true]);
    assert!(matches!(
        readers::index_lenient(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::PropsSchema,
            ..
        })
    ));
    let mut value = reader_fixtures::detail("product/browse/home");
    value["views"][0]["usage"]["instances"][0]["props"]["constructor"] = json!(["null"]);
    assert!(matches!(
        readers::detail_lenient(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::UsageProps,
            ..
        })
    ));
    value["schemaVersion"] = json!(3);
    value["token"] = json!("private");
    assert!(matches!(
        readers::detail_lenient(&value.to_string()),
        Err(ReadError::Version { expected: 4, .. })
    ));
    assert!(matches!(
        readers::index_lenient("{"),
        Err(ReadError::Invalid { .. })
    ));
    assert!(matches!(
        readers::detail_lenient("{"),
        Err(ReadError::Invalid { .. })
    ));
    let mut value = reader_fixtures::index();
    value["schemaVersion"] = json!(8);
    value["token"] = Value::Null;
    assert!(matches!(
        readers::index_lenient(&value.to_string()),
        Err(ReadError::Version { expected: 9, .. })
    ));
}
