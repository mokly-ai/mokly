//! Product selection and owned-field decisions.

use mkc_domain::billing::PRODUCT_LOOKUP_KEY_METADATA;

use super::fixtures::{catalogue, product, run};
use crate::stripe_catalogue::decision::{ProductDecision, decide_product};

#[test]
fn absent_product_is_created_with_complete_owned_fields() {
    let catalogue = catalogue();
    let ProductDecision::Create(input) = decide_product(&catalogue, &[], run()) else {
        panic!("expected product create");
    };
    assert_eq!(input.lookup_key, catalogue.product.lookup_key);
    assert_eq!(input.name, catalogue.product.name);
    assert_eq!(
        input.metadata.get(PRODUCT_LOOKUP_KEY_METADATA),
        Some(&catalogue.product.lookup_key.to_owned())
    );
}

#[test]
fn one_active_candidate_is_adopted() {
    let catalogue = catalogue();
    assert_eq!(
        decide_product(&catalogue, &[product("prod_active", true, 10)], run()),
        ProductDecision::Validated {
            id: "prod_active".to_owned()
        }
    );
}

#[test]
fn active_candidate_wins_over_newer_archived_candidate() {
    let catalogue = catalogue();
    let products = [
        product("prod_active", true, 1),
        product("prod_archived", false, 100),
    ];
    assert!(matches!(
        decide_product(&catalogue, &products, run()),
        ProductDecision::Validated { id } if id == "prod_active"
    ));
}

#[test]
fn one_archived_candidate_is_reactivated() {
    let catalogue = catalogue();
    let ProductDecision::Update { id, input } =
        decide_product(&catalogue, &[product("prod_archived", false, 10)], run())
    else {
        panic!("expected reactivation");
    };
    assert_eq!(id, "prod_archived");
    assert!(input.active);
    assert_eq!(input.name, catalogue.product.name);
}

#[test]
fn newest_archived_candidate_wins_then_greatest_bytewise_id_breaks_ties() {
    let catalogue = catalogue();
    let products = [
        product("prod_z", false, 9),
        product("prod_a", false, 10),
        product("prod_b", false, 10),
    ];
    assert!(matches!(
        decide_product(&catalogue, &products, run()),
        ProductDecision::Update { id, .. } if id == "prod_b"
    ));
}

#[test]
fn newer_of_two_archived_candidates_is_reactivated() {
    let catalogue = catalogue();
    let products = [
        product("prod_old", false, 9),
        product("prod_new", false, 10),
    ];
    assert!(matches!(
        decide_product(&catalogue, &products, run()),
        ProductDecision::Update { id, .. } if id == "prod_new"
    ));
}

#[test]
fn exactly_two_active_candidates_fail_with_sorted_ids() {
    let catalogue = catalogue();
    let products = [product("prod_z", true, 1), product("prod_a", true, 2)];
    assert!(matches!(
        decide_product(&catalogue, &products, run()),
        ProductDecision::DuplicateActive { products, .. }
            if products == ["prod_a".to_owned(), "prod_z".to_owned()]
    ));
}

#[test]
fn every_duplicate_active_id_is_sorted_in_the_failure() {
    let catalogue = catalogue();
    let products = [
        product("prod_z", true, 1),
        product("prod_a", true, 2),
        product("prod_m", true, 3),
    ];
    assert_eq!(
        decide_product(&catalogue, &products, run()),
        ProductDecision::DuplicateActive {
            lookup_key: catalogue.product.lookup_key.to_owned(),
            products: vec![
                "prod_a".to_owned(),
                "prod_m".to_owned(),
                "prod_z".to_owned()
            ]
        }
    );
}

#[test]
fn owned_name_drift_updates_while_unrelated_metadata_is_ignored() {
    let catalogue = catalogue();
    let mut drifted = product("prod_team", true, 10);
    drifted.name = "Old name".to_owned();
    drifted
        .metadata
        .insert("unrelated".to_owned(), "kept".to_owned());
    assert!(matches!(
        decide_product(&catalogue, &[drifted], run()),
        ProductDecision::Update { id, .. } if id == "prod_team"
    ));

    let mut matching = product("prod_team", true, 10);
    matching
        .metadata
        .insert("unrelated".to_owned(), "kept".to_owned());
    assert!(matches!(
        decide_product(&catalogue, &[matching], run()),
        ProductDecision::Validated { .. }
    ));
}

#[test]
fn a_product_without_the_identity_metadata_is_not_a_candidate() {
    let catalogue = catalogue();
    let mut other = product("prod_other", true, 10);
    other.metadata.clear();
    assert!(matches!(
        decide_product(&catalogue, &[other], run()),
        ProductDecision::Create(_)
    ));
}
