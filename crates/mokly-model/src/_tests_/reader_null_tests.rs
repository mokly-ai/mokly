//! Present optional values retain their declared types at receiver boundaries.

use serde_json::{Value, json};

use crate::read_contract::ContractViolation;
use crate::readers::public_reader_tests::empty_index;
use crate::readers::reader_fixtures;
use crate::readers::{self, ReadError};

#[test]
fn raw_optional_fields_reject_present_null() {
    let mut value = reader_fixtures::index();
    value["screens"][0]["previousPath"] = Value::Null;
    for result in [
        readers::index_lenient(&value.to_string()),
        readers::index(&value.to_string()),
    ] {
        assert!(
            matches!(
                result,
                Err(ReadError::Invalid {
                    boundary: "catalogue index",
                    ..
                })
            ),
            "previousPath must decode as a string when present"
        );
    }
}

#[test]
fn derived_optional_fields_reject_present_null() {
    for pointer in [
        "/live",
        "/components/0/propSchema/properties/label/title",
        "/components/0/controls/label/label",
    ] {
        let mut value = reader_fixtures::index();
        *value.pointer_mut(pointer).unwrap() = Value::Null;
        for result in [
            readers::index_lenient(&value.to_string()),
            readers::index(&value.to_string()),
        ] {
            assert!(
                matches!(
                    result,
                    Err(ReadError::Invalid {
                        boundary: "catalogue index",
                        ..
                    })
                ),
                "known optional {pointer} cannot contain null"
            );
        }
    }
    let mut value = reader_fixtures::detail("product");
    value["before"] = Value::Null;
    for result in [
        readers::detail_lenient(&value.to_string()),
        readers::detail(&value.to_string()),
    ] {
        assert!(
            matches!(
                result,
                Err(ReadError::Invalid {
                    boundary: "entry detail",
                    ..
                })
            ),
            "before must decode as an address when present"
        );
    }
}

#[test]
fn index_readers_reject_a_missing_comparison_url() {
    let mut value = empty_index();
    value.as_object_mut().unwrap().remove("comparisonUrl");
    for result in [
        readers::index_lenient(&value.to_string()),
        readers::index(&value.to_string()),
    ] {
        let error = result.expect_err("comparisonUrl must be present, as a root or null");
        assert!(matches!(
            error,
            ReadError::Invalid {
                boundary: "catalogue index",
                ..
            }
        ));
        assert_eq!(
            error.to_string(),
            "[mokly-model/read] invalid catalogue index: missing field `comparisonUrl`"
        );
    }
}

#[test]
fn nullable_comparison_constants_and_tagged_props_keep_their_values() {
    let expected = empty_index();
    for result in [
        readers::index_lenient(&expected.to_string()),
        readers::index(&expected.to_string()),
    ] {
        assert!(result.is_ok(), "a null comparisonUrl must remain accepted");
        assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), expected);
    }
    let mut value = reader_fixtures::index();
    value["components"][0]["propSchema"] = json!({"type":"object","additionalProperties":false,
        "properties":{"label":{"const":null}},"required":["label"]});
    value["components"][0]["props"] = json!({"label":["null"]});
    value["components"][0]["controls"] = json!({});
    for result in [
        readers::index_lenient(&value.to_string()),
        readers::index(&value.to_string()),
    ] {
        assert!(
            result.is_ok(),
            "const null and tagged null props must remain accepted"
        );
        assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), value);
    }
}

#[test]
fn unknown_null_extensions_remain_additive() {
    let expected = reader_fixtures::index();
    let mut value = expected.clone();
    value["identity"]["later"] = Value::Null;
    value["components"][0]["controls"]["label"]["later"] = Value::Null;
    let result = readers::index_lenient(&value.to_string());
    assert!(
        result.is_ok(),
        "unknown null index fields must remain additive"
    );
    assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), expected);
    assert!(matches!(
        readers::index(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::UnknownField,
            ..
        })
    ));
    let expected = reader_fixtures::detail("product/browse/home");
    let mut value = expected.clone();
    value["views"][0]["usage"]["instances"][0]["owner"]["later"] = Value::Null;
    let result = readers::detail_lenient(&value.to_string());
    assert!(
        result.is_ok(),
        "unknown null detail fields must remain additive"
    );
    assert_eq!(serde_json::to_value(result.unwrap()).unwrap(), expected);
    assert!(matches!(
        readers::detail(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::UnknownField,
            ..
        })
    ));
}
