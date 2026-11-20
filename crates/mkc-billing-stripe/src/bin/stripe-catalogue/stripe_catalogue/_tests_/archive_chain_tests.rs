//! Archive replacement-chain traversal through mocked provider reads.

use std::sync::Arc;

use mkc_billing_interface::catalogue::ExpandableProduct;
use mkc_billing_interface::catalogue_provider::CatalogueProviderMock;
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProviderMock;
use unimock::{MockFn, Unimock, matching};

use super::archive_support::{archiver, current_prices, linked_price};
use super::fixtures::{catalogue, product};
use crate::stripe_catalogue::archive::CatalogueArchive;
use crate::stripe_catalogue::decision::REPLACED_PRICE_METADATA;
use crate::stripe_catalogue::report::ReportLine;

const CREATED: i64 = 1_000;
const AFTER_HOLD: i64 = CREATED + 24 * 60 * 60;

#[test]
fn archived_link_is_skipped_while_wrong_product_metadata_less_predecessor_is_kept() {
    let mut current = current_prices(CREATED);
    current[0].metadata.insert(
        REPLACED_PRICE_METADATA.to_owned(),
        "price_archived".to_owned(),
    );
    let archived = linked_price(0, "price_archived", Some("price_old"), false);
    let mut old = linked_price(0, "price_old", None, true);
    old.product = ExpandableProduct::Id("prod_other".to_owned());
    old.metadata.clear();
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        empty_sweep(),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_archived"))
            .returns(Ok(archived)),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_old"))
            .returns(Ok(old)),
    )));
    let lines = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), false)
        .unwrap();
    assert!(
        rendered(&lines)
            .contains(&"price mokly_team_editor_usd_month would archive price_old".to_owned())
    );
    assert!(
        !rendered(&lines)
            .iter()
            .any(|line| line.contains("price_archived"))
    );
}

#[test]
fn chain_cycle_retrieves_each_identifier_once_and_orders_candidates() {
    let mut current = current_prices(CREATED);
    current[0]
        .metadata
        .insert(REPLACED_PRICE_METADATA.to_owned(), "price_b".to_owned());
    let b = linked_price(0, "price_b", Some("price_a"), true);
    let a = linked_price(0, "price_a", Some("price_b"), true);
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        empty_sweep(),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_b"))
            .returns(Ok(b)),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_a"))
            .returns(Ok(a)),
    )));
    let lines = rendered(
        &archiver(provider, AFTER_HOLD)
            .archive(&catalogue(), false)
            .unwrap(),
    );
    let editor = lines
        .iter()
        .filter(|line| line.contains("mokly_team_editor"))
        .cloned()
        .collect::<Vec<_>>();
    assert_eq!(
        editor,
        [
            "price mokly_team_editor_usd_month current price_editor_current",
            "price mokly_team_editor_usd_month would archive price_a",
            "price mokly_team_editor_usd_month would archive price_b",
        ]
    );
}

#[test]
fn chain_stops_cleanly_when_retrieval_returns_not_found() {
    let mut current = current_prices(CREATED);
    current[0].metadata.insert(
        REPLACED_PRICE_METADATA.to_owned(),
        "price_missing".to_owned(),
    );
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        empty_sweep(),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_missing"))
            .returns(Err(ProviderError::NotFound {
                detail: ProviderDetail::none(),
            })),
    )));
    let lines = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), true)
        .unwrap();
    assert_eq!(lines.len(), 2);
}

#[test]
fn chain_never_retrieves_or_archives_more_than_twenty_links() {
    let mut current = current_prices(CREATED);
    current[0]
        .metadata
        .insert(REPLACED_PRICE_METADATA.to_owned(), "price_00".to_owned());
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        empty_sweep(),
        CatalogueProviderMock::retrieve_price
            .each_call(matching!(_))
            .answers(&|_, id| {
                let index = id
                    .strip_prefix("price_")
                    .and_then(|value| value.parse::<usize>().ok())
                    .unwrap();
                let next = format!("price_{:02}", index + 1);
                Ok(linked_price(0, id, Some(&next), true))
            })
            .n_times(20),
    )));
    let lines = rendered(
        &archiver(provider, AFTER_HOLD)
            .archive(&catalogue(), false)
            .unwrap(),
    );
    assert_eq!(
        lines
            .iter()
            .filter(|line| line.contains("would archive price_"))
            .count(),
        20
    );
    assert!(!lines.iter().any(|line| line.contains("price_20")));
}

fn base_product() -> impl unimock::Clause {
    CatalogueProviderMock::list_products
        .next_call(matching!())
        .returns(Ok(vec![product("prod_team", true, 1)]))
}

fn lookup_prices(prices: Vec<Price>) -> impl unimock::Clause {
    BillingProviderMock::list_prices_by_lookup_keys
        .next_call(matching!(_))
        .returns(Ok(prices))
}

fn empty_sweep() -> impl unimock::Clause {
    CatalogueProviderMock::list_product_prices
        .next_call(matching!("prod_team"))
        .returns(Ok(Vec::new()))
}

fn rendered(lines: &[ReportLine]) -> Vec<String> {
    lines.iter().map(ToString::to_string).collect()
}
