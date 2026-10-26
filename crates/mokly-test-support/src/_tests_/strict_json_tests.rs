use serde_json::json;

use crate::strict_json::decode;

#[test]
fn nested_values_decode_and_duplicate_keys_fail_at_any_depth() {
    assert_eq!(
        decode(br#"{"a":[1,2.5,null,true],"b":{"c":"d"}}"#),
        Some(json!({"a": [1, 2.5, null, true], "b": {"c": "d"}}))
    );
    assert_eq!(decode(br#"{"a":1,"a":1}"#), None);
    assert_eq!(decode(br#"{"a":[{"b":1,"b":2}]}"#), None);
}

#[test]
fn a_byte_order_mark_and_invalid_utf8_fail() {
    assert_eq!(decode(b"\xef\xbb\xbf{}"), None);
    assert_eq!(decode(b"{\"a\":\"\xff\"}"), None);
}
