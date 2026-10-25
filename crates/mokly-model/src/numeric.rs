//! Exact comparisons across JSON integer and floating-point representations.

use num_cmp::NumCmp;
use serde_json::Number;

/// Compare finite JSON numbers without rounding large integer bounds.
pub(crate) fn greater(left: &Number, right: &Number) -> bool {
    if let Some(left) = left.as_i64() {
        if let Some(right) = right.as_i64() {
            return left > right;
        }
        if let Some(right) = right.as_u64() {
            return left.num_gt(right);
        }
        if let Some(right) = right.as_f64() {
            return left.num_gt(right);
        }
    }
    if let Some(left) = left.as_u64() {
        if let Some(right) = right.as_i64() {
            return left.num_gt(right);
        }
        if let Some(right) = right.as_u64() {
            return left > right;
        }
        if let Some(right) = right.as_f64() {
            return left.num_gt(right);
        }
    }
    if let Some(left) = left.as_f64() {
        if let Some(right) = right.as_i64() {
            return left.num_gt(right);
        }
        if let Some(right) = right.as_u64() {
            return left.num_gt(right);
        }
        if let Some(right) = right.as_f64() {
            return left > right;
        }
    }
    false
}

#[cfg(test)]
#[path = "_tests_/numeric_tests.rs"]
mod numeric_tests;
