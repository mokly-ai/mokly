//! Pure archive product, chain, and retention decisions.

use std::collections::BTreeSet;

use mkc_billing_interface::catalogue::ExpandableProduct;
use mkc_billing_interface::objects::Price;

use super::fixtures::{catalogue, price, product};
use crate::stripe_catalogue::archive_decision::{
    ArchiveProductDecision, RetentionDecision, assemble_replacement_chain, decide_archive_product,
    decide_retention,
};
use crate::stripe_catalogue::decision::REPLACED_PRICE_METADATA;

#[test]
fn archive_requires_exactly_one_active_product() {
    let catalogue = catalogue();
    assert_eq!(
        decide_archive_product(&catalogue, &[]),
        ArchiveProductDecision::Missing {
            lookup_key: catalogue.product.lookup_key.to_owned(),
        }
    );
    assert!(matches!(
        decide_archive_product(&catalogue, &[product("prod_archived", false, 10)]),
        ArchiveProductDecision::Missing { .. }
    ));
    assert_eq!(
        decide_archive_product(
            &catalogue,
            &[product("prod_z", true, 1), product("prod_a", true, 2),],
        ),
        ArchiveProductDecision::DuplicateActive {
            lookup_key: catalogue.product.lookup_key.to_owned(),
            products: vec!["prod_a".to_owned(), "prod_z".to_owned()],
        }
    );
}

#[test]
fn chain_skips_archived_prices_but_continues_through_them() {
    let current = linked_price("price_current", Some("price_archived"), true);
    let archived = linked_price("price_archived", Some("price_old"), false);
    let old = linked_price("price_old", None, true);
    let result = assemble_replacement_chain(
        &current,
        &[archived, old],
        &BTreeSet::new(),
        &BTreeSet::new(),
    );
    assert_eq!(result.candidates, BTreeSet::from(["price_old".to_owned()]));
    assert_eq!(result.next, None);
}

#[test]
fn chain_cycle_stops_after_each_identifier_is_considered_once() {
    let current = linked_price("price_current", Some("price_a"), true);
    let a = linked_price("price_a", Some("price_b"), true);
    let b = linked_price("price_b", Some("price_a"), true);
    let result = assemble_replacement_chain(&current, &[a, b], &BTreeSet::new(), &BTreeSet::new());
    assert_eq!(
        result.candidates,
        BTreeSet::from(["price_a".to_owned(), "price_b".to_owned()])
    );
    assert_eq!(result.next, None);
}

#[test]
fn chain_stops_after_twenty_links() {
    let current = linked_price("price_current", Some("price_00"), true);
    let mut retrieved = Vec::new();
    for index in 0..21 {
        let id = format!("price_{index:02}");
        let next = (index < 20).then(|| format!("price_{:02}", index + 1));
        retrieved.push(linked_price(&id, next.as_deref(), true));
    }
    let result =
        assemble_replacement_chain(&current, &retrieved, &BTreeSet::new(), &BTreeSet::new());
    assert_eq!(result.candidates.len(), 20);
    assert!(!result.candidates.contains("price_20"));
    assert_eq!(result.next, None);
}

#[test]
fn missing_retrieval_ends_the_chain_without_a_candidate() {
    let current = linked_price("price_current", Some("price_missing"), true);
    let result = assemble_replacement_chain(
        &current,
        &[],
        &BTreeSet::from(["price_missing".to_owned()]),
        &BTreeSet::new(),
    );
    assert!(result.candidates.is_empty());
    assert_eq!(result.next, None);
}

#[test]
fn chain_accepts_wrong_product_and_metadata_less_predecessors() {
    let current = linked_price("price_current", Some("price_old"), true);
    let mut old = linked_price("price_old", None, true);
    old.product = ExpandableProduct::Id("prod_other".to_owned());
    old.metadata.clear();
    let result = assemble_replacement_chain(&current, &[old], &BTreeSet::new(), &BTreeSet::new());
    assert_eq!(result.candidates, BTreeSet::from(["price_old".to_owned()]));
}

#[test]
fn retention_keeps_at_one_second_short_and_archives_at_exactly_twenty_four_hours() {
    assert_eq!(
        decide_retention(1_000, 1_000 + 24 * 60 * 60 - 1),
        RetentionDecision::Keep {
            until: 1_000 + 24 * 60 * 60,
        }
    );
    assert_eq!(
        decide_retention(1_000, 1_000 + 24 * 60 * 60),
        RetentionDecision::Archive
    );
    assert_eq!(
        decide_retention(i64::MAX, 0),
        RetentionDecision::InvalidTimestamp
    );
}

fn linked_price(id: &str, replaces: Option<&str>, active: bool) -> Price {
    let mut value = price(0, id);
    value.active = active;
    if let Some(replaces) = replaces {
        value
            .metadata
            .insert(REPLACED_PRICE_METADATA.to_owned(), replaces.to_owned());
    }
    value
}
