//! Streaming JSON budgets must reject before any typed collection is decoded.

use std::thread;

use serde::de::IgnoredAny;

use crate::index::CatalogueIndex;
use crate::json;
use crate::json_guard::{JSON_DEPTH, JSON_KEYS};
use crate::limits::Limits;

#[test]
fn duplicate_key_digests_use_decoded_text() {
    let bytes = br#"{"a":0,"\u0061":1}"#;
    assert_eq!(
        json::decode::<IgnoredAny>(bytes).unwrap_err().status_code(),
        400
    );
}

#[test]
fn json_depth_accepts_256_values_and_rejects_257() {
    assert_eq!(JSON_DEPTH, 256);
    for depth in [JSON_DEPTH, JSON_DEPTH + 1] {
        let bytes = format!("{}0{}", "[".repeat(depth - 1), "]".repeat(depth - 1));
        let result = json::decode::<IgnoredAny>(bytes.as_bytes());
        if depth == JSON_DEPTH {
            assert!(result.is_ok());
        } else {
            assert_eq!(result.unwrap_err().status_code(), 413);
        }
    }
}

#[test]
fn node_budget_precedes_typed_decoding() {
    let bytes = format!("[{}0]", "0,".repeat(4_194_303));
    assert_eq!(
        json::decode::<u64>(bytes.as_bytes())
            .unwrap_err()
            .status_code(),
        413
    );
}

#[test]
fn retained_key_budget_includes_ignored_objects() {
    let keys = (0..JSON_KEYS + 1)
        .map(|i| format!("\"{i}\":0"))
        .collect::<Vec<_>>()
        .join(",");
    let bytes = format!("{{{keys}}}");
    assert_eq!(
        json::decode::<IgnoredAny>(bytes.as_bytes())
            .unwrap_err()
            .status_code(),
        413
    );
}

#[test]
fn inclusive_node_and_key_budgets_accept_and_keys_are_shared_between_open_objects() {
    let bytes = format!("[{}0]", "0,".repeat(4_194_302));
    assert!(json::decode::<IgnoredAny>(bytes.as_bytes()).is_ok());
    let keys = (0..JSON_KEYS)
        .map(|i| format!("\"{i}\":0"))
        .collect::<Vec<_>>()
        .join(",");
    assert!(json::decode::<IgnoredAny>(format!("{{{keys}}}").as_bytes()).is_ok());
    let nested = format!("{{\"parent\":{{{keys}}}}}");
    assert_eq!(
        json::decode::<IgnoredAny>(nested.as_bytes())
            .unwrap_err()
            .status_code(),
        413
    );
    let keys = (0..JSON_KEYS / 2 + 1)
        .map(|i| format!("\"{i}\":0"))
        .collect::<Vec<_>>()
        .join(",");
    let siblings = format!("[{{{keys}}},{{{keys}}}]");
    assert!(json::decode::<IgnoredAny>(siblings.as_bytes()).is_ok());
}

#[test]
fn maximum_json_depth_index_fields_decode_on_a_two_mib_stack() {
    let thread = thread::Builder::new()
        .stack_size(2 * 1024 * 1024)
        .spawn(|| {
            let mut value = String::from("[\"null\"]");
            for _ in 0..125 {
                value = format!("[\"array\",[{value}]]");
            }
            value = format!("[\"object\",[[\"child\",{value}]]]");
            let index = include_str!("../../fixtures/index-v9.json");
            let document = index.replacen('{', &format!("{{\"extra\":{value},"), 1);
            let index = CatalogueIndex::parse(document.as_bytes(), Limits::default()).unwrap();
            assert_eq!(index.current_screens().len(), 2);
        })
        .unwrap();
    thread.join().unwrap();
}
