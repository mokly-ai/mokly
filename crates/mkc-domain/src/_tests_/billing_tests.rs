//! Catalogue/document agreement and plan derivation cases.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;

use crate::billing::{
    CATALOGUE, IdentityViolation, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA,
};
use crate::values::{Plan, Role, SeatKind, Visibility};

const BILLING: &str = include_str!("../../../../docs/protocol/cloud/billing.md");
const BILLING_CATALOGUE: &str =
    include_str!("../../../../docs/protocol/cloud/billing-catalogue.md");

#[test]
fn typed_catalogue_matches_the_billing_protocol_tables() {
    let team = table_row("| `team`");
    assert_eq!(
        team[4],
        "Editor `2000` USD cents, Collaborator `500` USD cents"
    );
    assert_eq!(CATALOGUE.seats[0].kind, SeatKind::Editor);
    assert_eq!(
        CATALOGUE.seats[0].unit_amount_cents,
        amount(team[4], "Editor")
    );
    assert_eq!(CATALOGUE.seats[1].kind, SeatKind::Collaborator);
    assert_eq!(
        CATALOGUE.seats[1].unit_amount_cents,
        amount(team[4], "Collaborator")
    );

    let mut setting_rows = BILLING
        .lines()
        .skip_while(|line| !line.starts_with("| Setting"));
    setting_rows.next().expect("settings header");
    setting_rows.next().expect("settings separator");
    let settings: BTreeMap<_, _> = setting_rows
        .take_while(|line| line.starts_with('|'))
        .map(|line| {
            let cells = cells(line);
            (cells[0], cells[1])
        })
        .collect();
    assert_eq!(
        settings["Billing interval"].trim_matches('`'),
        CATALOGUE.interval
    );
    assert_eq!(
        settings["Usage type"].trim_matches('`'),
        CATALOGUE.usage_type
    );
    assert_eq!(settings["Currency"].trim_matches('`'), CATALOGUE.currency);
    assert_eq!(
        settings["Trial"],
        format!("`{}` days, once", CATALOGUE.trial_days)
    );
    assert_eq!(
        settings["Stripe API version"].trim_matches('`'),
        CATALOGUE.stripe_version
    );
}

#[test]
fn typed_identity_matches_the_billing_catalogue_protocol_tables() {
    let rows = identity_rows();
    assert_eq!(rows.len(), CATALOGUE.seats.len());
    for (row, seat) in rows.iter().zip(CATALOGUE.seats) {
        assert_eq!(row[0].trim_matches('`'), CATALOGUE.product.plan.as_str());
        assert_eq!(row[1].trim_matches('`'), CATALOGUE.product.lookup_key);
        assert_eq!(row[2].trim_matches('`'), CATALOGUE.product.name);
        assert_eq!(row[3].trim_matches('`'), seat.kind.as_str());
        assert_eq!(row[4].trim_matches('`'), seat.lookup_key);
        assert_eq!(row[5].trim_matches('`'), seat.nickname);
    }

    let settings = identity_settings();
    assert_eq!(
        settings["Product metadata key"].trim_matches('`'),
        PRODUCT_LOOKUP_KEY_METADATA
    );
    assert_eq!(
        settings["Price metadata key"],
        format!(
            "`{PRICE_SEAT_KIND_METADATA}` (`{}`/`{}`)",
            CATALOGUE.seats[0].kind.as_str(),
            CATALOGUE.seats[1].kind.as_str()
        )
    );
    for seat in CATALOGUE.seats {
        assert_eq!(
            settings["Tax behavior"].trim_matches('`'),
            seat.tax_behavior.as_str()
        );
    }
    assert_eq!(settings["Key grammar"], "`^mokly_[a-z0-9_]+$`");
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

fn table_row(prefix: &str) -> Vec<&'static str> {
    cells(
        BILLING
            .lines()
            .find(|line| line.starts_with(prefix))
            .expect("catalogue row"),
    )
}

fn identity_rows() -> Vec<Vec<&'static str>> {
    BILLING_CATALOGUE
        .lines()
        .skip_while(|line| !line.starts_with("| Plan"))
        .skip(2)
        .take_while(|line| line.starts_with('|'))
        .map(cells)
        .collect()
}

fn identity_settings() -> BTreeMap<&'static str, &'static str> {
    BILLING_CATALOGUE
        .lines()
        .skip_while(|line| !line.starts_with("| Identity setting"))
        .skip(2)
        .take_while(|line| line.starts_with('|'))
        .map(|line| {
            let row = cells(line);
            (row[0], row[1])
        })
        .collect()
}

fn cells(row: &str) -> Vec<&str> {
    row.trim_matches('|').split('|').map(str::trim).collect()
}

fn amount(cell: &str, kind: &str) -> u32 {
    cell.split_once(kind)
        .and_then(|(_, value)| value.split('`').nth(1))
        .expect("seat amount")
        .parse()
        .expect("numeric seat amount")
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
