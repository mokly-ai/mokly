//! The background pass's window follows the smaller Serve bound.

use super::background_batch;

#[test]
fn the_background_batch_is_the_smaller_bound() {
    assert_eq!(background_batch(8, 8), 8);
    assert_eq!(background_batch(8, 2), 2);
    assert_eq!(background_batch(4, 16), 4);
    assert_eq!(background_batch(1, 1), 1);
}
