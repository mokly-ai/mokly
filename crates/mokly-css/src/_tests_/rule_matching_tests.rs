//! Selector match de-duplication keeps linear operation growth for broad rules.

use std::collections::BTreeSet;

use mokly_model::review_affected::ReviewSide;

use crate::rule_matching::push_unique;

fn probe(size: usize) -> (usize, usize) {
    let mut elements = Vec::new();
    let mut seen = BTreeSet::new();
    let mut operations = 0;
    for side in [ReviewSide::Before, ReviewSide::After] {
        for element in 0..size {
            push_unique(&mut elements, &mut seen, side, element, &mut operations);
        }
    }
    for side in [ReviewSide::Before, ReviewSide::After] {
        for element in 0..size {
            push_unique(&mut elements, &mut seen, side, element, &mut operations);
        }
    }
    (elements.len(), operations)
}

#[test]
fn broad_selector_duplicate_checks_grow_linearly() {
    let (small_output, small_operations) = probe(16);
    let (large_output, large_operations) = probe(64);
    assert_eq!(small_output, 32);
    assert_eq!(large_output, 128);
    assert!(small_operations > 0);
    assert_eq!(large_operations, 4 * small_operations);
}
