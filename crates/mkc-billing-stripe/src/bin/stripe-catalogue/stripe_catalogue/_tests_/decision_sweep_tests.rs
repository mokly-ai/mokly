//! Archive product-sweep selection and deterministic union ordering.

use std::collections::BTreeSet;

use super::fixtures::{catalogue, price};
use crate::stripe_catalogue::archive_decision::{ordered_superseded, select_product_sweep};

#[test]
fn selects_keyless_and_non_catalogue_prices_with_matching_seat_metadata() {
    let catalogue = catalogue();
    let mut keyless = price(0, "price_keyless");
    keyless.lookup_key = None;
    let mut foreign = price(0, "price_foreign");
    foreign.lookup_key = Some("other_lookup_key".to_owned());
    assert_eq!(
        select_product_sweep(
            &catalogue,
            &catalogue.seats[0],
            &[keyless, foreign],
            &BTreeSet::new(),
        ),
        BTreeSet::from(["price_foreign".to_owned(), "price_keyless".to_owned()])
    );
}

#[test]
fn ignores_inactive_metadata_less_unknown_kind_and_catalogue_key_prices() {
    let catalogue = catalogue();
    let mut inactive = price(0, "price_inactive");
    inactive.active = false;
    inactive.lookup_key = None;
    let mut without_metadata = price(0, "price_without_metadata");
    without_metadata.metadata.clear();
    without_metadata.lookup_key = None;
    let mut unknown_kind = price(0, "price_unknown_kind");
    unknown_kind
        .metadata
        .insert("mokly_seat_kind".to_owned(), "viewer".to_owned());
    unknown_kind.lookup_key = None;
    let current = price(0, "price_current");
    assert!(
        select_product_sweep(
            &catalogue,
            &catalogue.seats[0],
            &[inactive, without_metadata, unknown_kind, current],
            &BTreeSet::new(),
        )
        .is_empty()
    );
}

#[test]
fn excludes_both_current_prices_and_other_seat_candidates() {
    let catalogue = catalogue();
    let mut editor_current = price(0, "price_editor_current");
    editor_current.lookup_key = None;
    let mut collaborator_current = price(1, "price_collaborator_current");
    collaborator_current.lookup_key = None;
    let mut collaborator_old = price(1, "price_collaborator_old");
    collaborator_old.lookup_key = None;
    let excluded = BTreeSet::from([editor_current.id.clone(), collaborator_current.id.clone()]);
    assert!(
        select_product_sweep(
            &catalogue,
            &catalogue.seats[0],
            &[editor_current, collaborator_current, collaborator_old],
            &excluded,
        )
        .is_empty()
    );
}

#[test]
fn chain_and_sweep_union_is_deduplicated_excluded_and_bytewise_sorted() {
    let chain = BTreeSet::from([
        "price_z".to_owned(),
        "price_shared".to_owned(),
        "price_current".to_owned(),
    ]);
    let sweep = BTreeSet::from([
        "price_a".to_owned(),
        "price_shared".to_owned(),
        "price_other_current".to_owned(),
    ]);
    let excluded = BTreeSet::from(["price_current".to_owned(), "price_other_current".to_owned()]);
    assert_eq!(
        ordered_superseded(&chain, &sweep, &excluded),
        ["price_a", "price_shared", "price_z"]
    );
}
