//! Core props and viewer wire props share binary64 integer values.

use serde_json::json;

use crate::data::{Props, unsafe_integer_paths};
use crate::{wire_decode, wire_props};

#[test]
fn unsafe_integers_round_at_plain_data_decoding_and_round_trip_losslessly() {
    let props: Props = serde_json::from_value(json!({
        "positive": 9_007_199_254_740_993_u64,
        "up": 9_007_199_254_740_995_u64,
        "a/b": {"~": [-9_007_199_254_740_993_i64, u64::MAX]},
        "safe": 9_007_199_254_740_991_u64,
        "negativeZero": -0.0,
        "fraction": 1.25
    }))
    .unwrap();
    assert_eq!(
        serde_json::to_value(&props).unwrap(),
        json!({
            "positive": 9_007_199_254_740_992.0,
            "up": 9_007_199_254_740_996.0,
            "a/b": {"~": [-9_007_199_254_740_992.0, 18_446_744_073_709_551_616.0]},
            "safe": 9_007_199_254_740_991_u64,
            "negativeZero": -0.0,
            "fraction": 1.25
        })
    );
    assert_eq!(
        wire_decode::decode(&wire_props::encode(&props)).unwrap(),
        props
    );
    assert_eq!(
        unsafe_integer_paths(&props),
        ["/a~1b/~0/0", "/a~1b/~0/1", "/positive", "/up"]
    );
}
