//! Numeric ordering across JSON's integer and float storage forms.

use serde_json::json;

use crate::numeric::greater;

#[test]
fn ordering_does_not_round_large_integers_or_mix_signedness() {
    for (left, right, expected) in [
        (json!(9007199254740993u64), json!(9007199254740992.0), true),
        (json!(9007199254740992.0), json!(9007199254740993u64), false),
        (json!(u64::MAX), json!(-1), true),
        (json!(-1), json!(u64::MAX), false),
        (json!(u64::MAX), json!(1e200), false),
        (json!(1e200), json!(u64::MAX), true),
        (json!(-1.5), json!(-2), true),
        (json!(2), json!(2.5), false),
        (json!(2.5), json!(2.0), true),
        (json!(2.0), json!(2.0), false),
    ] {
        assert_eq!(
            greater(left.as_number().unwrap(), right.as_number().unwrap()),
            expected
        );
    }
}
