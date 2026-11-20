//! Checkout persistence conversion regressions.

#![allow(clippy::unwrap_used)]

use mkc_domain::values::SeatKind;

use super::{persisted_quantity, persisted_trial_days};

#[test]
fn persisted_values_reject_quantities_outside_database_range() {
    assert!(persisted_quantity(SeatKind::Editor, i64::from(i32::MAX) + 1).is_err());
    assert!(persisted_quantity(SeatKind::Collaborator, i64::from(i32::MIN) - 1).is_err());
    assert_eq!(
        persisted_quantity(SeatKind::Editor, i64::from(i32::MAX)).unwrap(),
        i32::MAX
    );
    assert_eq!(persisted_trial_days(7).unwrap(), 7);
}
