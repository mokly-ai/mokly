//! Nullable steps preserve storage spellings and the public null value.

#![allow(clippy::unwrap_used)]

use mkc_store_interface::build_state::BuildStep;
use serde_json::to_value;

use super::BuildStepView;

#[test]
fn step_mapping_preserves_all_wire_values_and_null() {
    for step in [
        None,
        Some(BuildStep::Checkout),
        Some(BuildStep::Install),
        Some(BuildStep::Publish),
    ] {
        assert_eq!(
            to_value(BuildStepView::from(step)).unwrap(),
            to_value(step).unwrap()
        );
    }
}
