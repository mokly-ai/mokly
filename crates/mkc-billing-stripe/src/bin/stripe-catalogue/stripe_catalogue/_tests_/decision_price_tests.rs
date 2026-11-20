//! Immutable and mutable catalogue price decisions.

use mkc_billing_interface::catalogue::{ExpandableProduct, TaxBehavior};

use super::fixtures::{catalogue, price, run};
use crate::stripe_catalogue::decision::{PriceDecision, REPLACED_PRICE_METADATA, decide_price};

#[test]
fn missing_price_is_created_with_complete_fields() {
    let catalogue = catalogue();
    let seat = &catalogue.seats[0];
    let PriceDecision::Create(fields) =
        decide_price(&catalogue, seat, Some("prod_team"), None, run())
    else {
        panic!("expected price create");
    };
    let input = fields.create_input(run(), "prod_team", None);
    assert_eq!(input.product, "prod_team");
    assert_eq!(input.lookup_key, seat.lookup_key);
    assert_eq!(input.unit_amount, 2_000);
    assert_eq!(input.replaces, None);
    assert_eq!(input.metadata.len(), 1);
}

#[test]
fn complete_price_is_validated_and_unrelated_metadata_is_ignored() {
    let catalogue = catalogue();
    let mut current = price(0, "price_editor");
    current
        .metadata
        .insert("unrelated".to_owned(), "kept".to_owned());
    current.metadata.insert(
        REPLACED_PRICE_METADATA.to_owned(),
        "price_ancestor".to_owned(),
    );
    assert_eq!(
        decide_price(
            &catalogue,
            &catalogue.seats[0],
            Some("prod_team"),
            Some(&current),
            run(),
        ),
        PriceDecision::Validated {
            id: "price_editor".to_owned()
        }
    );
}

#[test]
fn every_immutable_field_difference_replaces_the_price() {
    let catalogue = catalogue();
    let seat = &catalogue.seats[0];
    let mut cases = Vec::new();

    let mut product = price(0, "wrong-product");
    product.product = ExpandableProduct::Id("prod_other".to_owned());
    cases.push(product);
    let mut currency = price(0, "wrong-currency");
    currency.currency = "eur".to_owned();
    cases.push(currency);
    let mut amount = price(0, "wrong-amount");
    amount.unit_amount = Some(2_001);
    cases.push(amount);
    let mut interval = price(0, "wrong-interval");
    interval.recurring.as_mut().unwrap().interval = "year".to_owned();
    cases.push(interval);
    let mut usage = price(0, "wrong-usage");
    usage.recurring.as_mut().unwrap().usage_type = "metered".to_owned();
    cases.push(usage);
    let mut tax = price(0, "wrong-tax");
    tax.tax_behavior = Some(TaxBehavior::Inclusive);
    cases.push(tax);

    for current in cases {
        let PriceDecision::Replace {
            predecessor,
            repair,
            fields,
        } = decide_price(&catalogue, seat, Some("prod_team"), Some(&current), run())
        else {
            panic!("expected replacement for {}", current.id);
        };
        assert_eq!(predecessor, current.id);
        assert_eq!(repair, None);
        let input = fields.create_input(run(), "prod_team", Some(&predecessor));
        assert_eq!(input.replaces, Some(predecessor.clone()));
        assert_eq!(
            input.metadata.get(REPLACED_PRICE_METADATA),
            Some(&predecessor)
        );
        assert_eq!(
            input.metadata.get("mokly_seat_kind"),
            Some(&"editor".to_owned())
        );
    }
}

#[test]
fn immutable_drift_repairs_mutable_fields_before_replacement() {
    let catalogue = catalogue();
    let seat = &catalogue.seats[0];

    let mut missing_tag = price(0, "missing-tag");
    missing_tag.unit_amount = Some(2_001);
    missing_tag.metadata.remove("mokly_seat_kind");

    let mut wrong_tag = price(0, "wrong-tag");
    wrong_tag.unit_amount = Some(2_001);
    wrong_tag
        .metadata
        .insert("mokly_seat_kind".to_owned(), "collaborator".to_owned());

    let mut wrong_nickname = price(0, "wrong-nickname");
    wrong_nickname.unit_amount = Some(2_001);
    wrong_nickname.nickname = Some("Old nickname".to_owned());

    for current in [missing_tag, wrong_tag, wrong_nickname] {
        let PriceDecision::Replace {
            predecessor,
            repair: Some(repair),
            ..
        } = decide_price(&catalogue, seat, Some("prod_team"), Some(&current), run())
        else {
            panic!(
                "expected replacement with predecessor repair for {}",
                current.id
            );
        };
        assert_eq!(predecessor, current.id);
        assert_eq!(repair.nickname.as_deref(), Some("Editor seat"));
        assert_eq!(repair.metadata.len(), 1);
        assert_eq!(
            repair.metadata.get("mokly_seat_kind").map(String::as_str),
            Some("editor")
        );
        assert_eq!(repair.active, None);
    }
}

#[test]
fn absent_immutable_values_replace_the_price() {
    let catalogue = catalogue();
    let mut amount = price(0, "missing-amount");
    amount.unit_amount = None;
    let mut recurring = price(0, "missing-recurring");
    recurring.recurring = None;
    let mut tax = price(0, "missing-tax");
    tax.tax_behavior = None;
    for current in [amount, recurring, tax] {
        assert!(matches!(
            decide_price(
                &catalogue,
                &catalogue.seats[0],
                Some("prod_team"),
                Some(&current),
                run(),
            ),
            PriceDecision::Replace { .. }
        ));
    }
}

#[test]
fn nickname_drift_updates_both_owned_mutable_fields() {
    let catalogue = catalogue();
    let mut current = price(0, "price_editor");
    current.nickname = Some("Old nickname".to_owned());
    current.metadata.insert(
        REPLACED_PRICE_METADATA.to_owned(),
        "price_ancestor".to_owned(),
    );
    let PriceDecision::Update { input, .. } = decide_price(
        &catalogue,
        &catalogue.seats[0],
        Some("prod_team"),
        Some(&current),
        run(),
    ) else {
        panic!("expected mutable update");
    };
    assert_eq!(input.nickname.as_deref(), Some("Editor seat"));
    assert_eq!(input.metadata.len(), 1);
    assert_eq!(input.active, None);
}

#[test]
fn owned_metadata_drift_updates_the_price() {
    let catalogue = catalogue();
    let mut current = price(0, "price_editor");
    current
        .metadata
        .insert("mokly_seat_kind".to_owned(), "collaborator".to_owned());
    assert!(matches!(
        decide_price(
            &catalogue,
            &catalogue.seats[0],
            Some("prod_team"),
            Some(&current),
            run(),
        ),
        PriceDecision::Update { .. }
    ));
}

#[test]
fn any_existing_price_replaces_when_the_product_is_still_pending() {
    let catalogue = catalogue();
    let current = price(0, "price_editor");
    assert!(matches!(
        decide_price(
            &catalogue,
            &catalogue.seats[0],
            None,
            Some(&current),
            run(),
        ),
        PriceDecision::Replace { predecessor, .. } if predecessor == "price_editor"
    ));
}
