//! Review encoding keeps explicit empty arrays and omits empty evidence lists.

use crate::canonical;
use crate::review::ReviewResultV8;

#[test]
fn review_encoding_keeps_empty_arrays_and_omits_empty_evidence() {
    let result: ReviewResultV8 =
        serde_json::from_str(include_str!("fixtures/review-v8.json")).unwrap();
    let bytes = canonical::to_string(&result).unwrap();
    insta::assert_snapshot!(bytes);
    assert!(!bytes.contains("\"resources\""));
}
