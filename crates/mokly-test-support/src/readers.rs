//! Read output documents through the model's validating readers.

use mokly_model::readers;
use serde_json::Value;

/// Check `bytes` with the catalogue index v7 reader and return them as JSON.
pub fn index(bytes: &[u8]) -> Value {
    let text = std::str::from_utf8(bytes).expect("the index is UTF-8");
    readers::index(text).expect("the model reader accepts the index");
    serde_json::from_str(text).unwrap()
}

/// Check `bytes` with the review v8 reader and return them as JSON.
pub fn review(bytes: &[u8]) -> Value {
    let text = std::str::from_utf8(bytes).expect("the review is UTF-8");
    readers::review(text).expect("the model reader accepts the review");
    serde_json::from_str(text).unwrap()
}

/// Check `bytes` with the entry detail v2 reader and return them as JSON.
pub fn detail(bytes: &[u8]) -> Value {
    let text = std::str::from_utf8(bytes).expect("the detail is UTF-8");
    readers::detail(text).expect("the model reader accepts the detail");
    serde_json::from_str(text).unwrap()
}
