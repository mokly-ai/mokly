//! Finite domain value round-trip cases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fmt::Debug;
use std::str::FromStr;

use crate::values::{Error, Plan, Role, SeatKind, Visibility};

#[test]
fn seat_kinds_round_trip_through_stable_values() {
    for kind in [SeatKind::Editor, SeatKind::Collaborator] {
        assert_eq!(kind.as_str().parse::<SeatKind>().unwrap(), kind);
    }
    assert!(matches!(
        "observer".parse::<SeatKind>(),
        Err(Error::SeatKind)
    ));
}

#[test]
fn plans_roles_and_visibilities_round_trip_through_stable_values() {
    round_trip([Plan::Free, Plan::Team], Plan::as_str);
    round_trip(
        [Role::Reviewer, Role::Member, Role::Admin, Role::Owner],
        Role::as_str,
    );
    round_trip(
        [Visibility::Private, Visibility::Public],
        Visibility::as_str,
    );
    assert!(matches!("enterprise".parse::<Plan>(), Err(Error::Plan)));
    assert!(matches!("observer".parse::<Role>(), Err(Error::Role)));
    assert!(matches!(
        "internal".parse::<Visibility>(),
        Err(Error::Visibility)
    ));
}

fn round_trip<T, const N: usize>(values: [T; N], spelling: fn(T) -> &'static str)
where
    T: Copy + Debug + Eq + FromStr<Err = Error>,
{
    for value in values {
        assert_eq!(spelling(value).parse::<T>().unwrap(), value);
    }
}

#[test]
fn role_discriminants_preserve_privilege_order() {
    let roles = [Role::Reviewer, Role::Member, Role::Admin, Role::Owner];
    assert!(roles.windows(2).all(|pair| pair[0] < pair[1]));
    assert_eq!(roles.map(|role| role as u8), [0, 1, 2, 3]);
    assert_eq!(roles.map(Role::can_admin), [false, false, true, true]);
    assert_eq!(
        roles.map(Role::project_role),
        [Role::Reviewer, Role::Member, Role::Admin, Role::Admin]
    );
}
