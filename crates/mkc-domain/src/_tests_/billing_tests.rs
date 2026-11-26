//! Typed catalogue values and plan derivation cases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use crate::billing::{
    CATALOGUE, IdentityViolation, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA,
};
use crate::values::{Plan, Role, SeatKind, Visibility};

#[test]
fn typed_catalogue_states_the_team_seat_prices_and_settings() {
    assert_eq!(CATALOGUE.seats[0].kind, SeatKind::Editor);
    assert_eq!(CATALOGUE.seats[0].unit_amount_cents, 2000);
    assert_eq!(CATALOGUE.seats[1].kind, SeatKind::Collaborator);
    assert_eq!(CATALOGUE.seats[1].unit_amount_cents, 500);

    assert_eq!(CATALOGUE.interval, "month");
    assert_eq!(CATALOGUE.usage_type, "licensed");
    assert_eq!(CATALOGUE.currency, "usd");
    assert_eq!(CATALOGUE.trial_days, 7);
    assert_eq!(CATALOGUE.stripe_version, "2026-08-26.dahlia");
}

#[test]
fn typed_identity_states_the_stripe_product_and_price_keys() {
    let identity: Vec<_> = CATALOGUE
        .seats
        .iter()
        .map(|seat| {
            (
                CATALOGUE.product.plan.as_str(),
                CATALOGUE.product.lookup_key,
                CATALOGUE.product.name,
                seat.kind.as_str(),
                seat.lookup_key,
                seat.nickname,
            )
        })
        .collect();
    assert_eq!(
        identity,
        vec![
            (
                "team",
                "mokly_team",
                "Mokly Team",
                "editor",
                "mokly_team_editor_usd_month",
                "Editor seat",
            ),
            (
                "team",
                "mokly_team",
                "Mokly Team",
                "collaborator",
                "mokly_team_collaborator_usd_month",
                "Collaborator seat",
            ),
        ]
    );

    assert_eq!(PRODUCT_LOOKUP_KEY_METADATA, "mokly_lookup_key");
    assert_eq!(PRICE_SEAT_KIND_METADATA, "mokly_seat_kind");
    for seat in CATALOGUE.seats {
        assert_eq!(seat.tax_behavior.as_str(), "exclusive", "{:?}", seat.kind);
    }
    assert!(CATALOGUE.identity_violations().is_empty());
}

#[test]
fn identity_validation_rejects_a_key_outside_the_documented_grammar() {
    let mut catalogue = CATALOGUE;
    catalogue.seats[0].lookup_key = "mokly_Editor";
    assert_eq!(
        catalogue.identity_violations(),
        vec![IdentityViolation::InvalidLookupKey {
            key: "mokly_Editor"
        }]
    );
}

#[test]
fn identity_validation_rejects_a_duplicate_key() {
    let mut catalogue = CATALOGUE;
    catalogue.seats[1].lookup_key = catalogue.seats[0].lookup_key;
    assert_eq!(
        catalogue.identity_violations(),
        vec![IdentityViolation::DuplicateLookupKey {
            key: "mokly_team_editor_usd_month"
        }]
    );
}

#[test]
fn identity_validation_requires_the_team_product() {
    let mut catalogue = CATALOGUE;
    catalogue.product.plan = Plan::Free;
    assert_eq!(
        catalogue.identity_violations(),
        vec![IdentityViolation::ProductPlanNotTeam { plan: Plan::Free }]
    );
}

#[test]
fn identity_validation_rejects_an_empty_product_name() {
    let mut catalogue = CATALOGUE;
    catalogue.product.name = "";
    assert_eq!(
        catalogue.identity_violations(),
        vec![IdentityViolation::EmptyProductName]
    );
}

#[test]
fn identity_validation_rejects_an_empty_price_nickname() {
    let mut catalogue = CATALOGUE;
    catalogue.seats[1].nickname = "";
    assert_eq!(
        catalogue.identity_violations(),
        vec![IdentityViolation::EmptyPriceNickname {
            kind: SeatKind::Collaborator
        }]
    );
}

#[test]
fn roles_derive_the_documented_seat_kind() {
    for role in [Role::Owner, Role::Admin, Role::Member] {
        assert_eq!(SeatKind::of_role(role), SeatKind::Editor);
    }
    assert_eq!(SeatKind::of_role(Role::Reviewer), SeatKind::Collaborator);
}

#[test]
fn only_team_allows_private_projects() {
    assert!(!Plan::Free.allows_private_projects());
    assert!(Plan::Team.allows_private_projects());
}

#[test]
fn publication_permission_uses_the_plan_catalogue() {
    for (plan, visibility, allowed) in [
        (Plan::Free, Visibility::Public, true),
        (Plan::Free, Visibility::Private, false),
        (Plan::Team, Visibility::Public, true),
        (Plan::Team, Visibility::Private, true),
    ] {
        assert_eq!(plan.allows_publication(visibility), allowed);
    }
}
