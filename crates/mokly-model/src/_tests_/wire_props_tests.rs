//! Canonical wire props preserve allowed data and reject ambiguous encodings.

use serde_json::json;

use crate::data::{DataValue, Props};
use crate::wire_decode::decode;
use crate::wire_props::{ComponentWireProps, encode};

#[test]
fn integer_props_keep_their_json_kind_on_a_wire_round_trip() {
    let props: Props = serde_json::from_value(
        json!({"n":3,"negative":-7,"f":1.5,"zero":0,"edge":9_007_199_254_740_991_i64}),
    )
    .unwrap();
    assert_eq!(decode(&encode(&props)).unwrap(), props);
}

#[test]
fn tagged_props_round_trip_negative_zero_and_utf16_tuple_keys() {
    let props: Props = serde_json::from_value(
        json!({"negative":-0.0,"nested":{"10":2,"2":1,"array":[null,true,"text"]}}),
    )
    .unwrap();
    let wire = encode(&props);
    assert_eq!(
        serde_json::to_value(&wire).unwrap()["negative"],
        json!(["number", "-0"])
    );
    let decoded = decode(&wire).unwrap();
    let DataValue::Number(negative) = &decoded["negative"] else {
        panic!()
    };
    assert!(negative.as_f64().unwrap().is_sign_negative());
    assert_eq!(
        serde_json::to_value(encode(&decoded)).unwrap(),
        serde_json::to_value(wire).unwrap()
    );
}

#[test]
fn alternate_numbers_duplicate_keys_and_reserved_keys_fail() {
    for value in [
        json!({"v":["number","1.0"]}),
        json!({"v":["number","+1"]}),
        json!({"v":["number","NaN"]}),
        json!({"v":["object",[["a",["null"]],["a",["null"]]]]}),
        json!({"v":["object",[["2",["null"]],["10",["null"]]]]}),
        json!({"v":["object",[["constructor",["null"]]]]}),
    ] {
        let wire: ComponentWireProps = serde_json::from_value(value).unwrap();
        assert!(decode(&wire).is_err());
    }
}
