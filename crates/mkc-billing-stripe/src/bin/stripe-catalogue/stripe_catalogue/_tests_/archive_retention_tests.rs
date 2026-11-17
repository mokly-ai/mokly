//! Archive retention, write intent, de-duplication, and partial-failure behavior.

use std::sync::Arc;

use mkc_billing_interface::catalogue_provider::CatalogueProviderMock;
use mkc_billing_interface::error::Error as ProviderError;
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProviderMock;
use unimock::{MockFn, Unimock, matching};

use super::archive_support::{archiver, current_prices, linked_price, run_id};
use super::fixtures::{catalogue, price, product};
use crate::stripe_catalogue::archive::CatalogueArchive;
use crate::stripe_catalogue::decision::REPLACED_PRICE_METADATA;
use crate::stripe_catalogue::report::ReportLine;

const CREATED: i64 = 1_000;
const HOLD: i64 = 24 * 60 * 60;

#[test]
fn candidate_is_kept_at_twenty_three_hours_fifty_nine_minutes_fifty_nine_seconds() {
    let mut swept = price(0, "price_old");
    swept.lookup_key = None;
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current_prices(CREATED)),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(vec![swept])),
    )));
    let lines = rendered(
        archiver(provider, CREATED + HOLD - 1)
            .archive(&catalogue(), true)
            .unwrap(),
    );
    assert_eq!(
        lines[1],
        "price mokly_team_editor_usd_month kept price_old until 1970-01-02T00:16:40Z"
    );
}

#[test]
fn exact_twenty_four_hours_archives_once_with_only_active_false_and_one_run() {
    let mut current = current_prices(CREATED);
    current[0]
        .metadata
        .insert(REPLACED_PRICE_METADATA.to_owned(), "price_old".to_owned());
    let mut old = linked_price(0, "price_old", None, true);
    old.lookup_key = None;
    let archived = {
        let mut value = old.clone();
        value.active = false;
        value
    };
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(vec![old.clone()])),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_old"))
            .returns(Ok(old)),
        CatalogueProviderMock::update_price
            .next_call(matching!((id, input) if
                *id == "price_old"
                    &&
                input.run == run_id()
                    && input.nickname.is_none()
                    && input.metadata.is_empty()
                    && input.active == Some(false)
            ))
            .returns(Ok(archived)),
    )));
    let lines = rendered(
        archiver(provider, CREATED + HOLD)
            .archive(&catalogue(), true)
            .unwrap(),
    );
    assert_eq!(
        lines
            .iter()
            .filter(|line| line.contains("archived price_old"))
            .count(),
        1
    );
}

#[test]
fn mid_run_write_failure_keeps_every_completed_line() {
    let mut a = price(0, "price_a");
    a.lookup_key = None;
    let mut b = price(0, "price_b");
    b.lookup_key = None;
    let mut archived = a.clone();
    archived.active = false;
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current_prices(CREATED)),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(vec![b, a])),
        CatalogueProviderMock::update_price
            .next_call(matching!("price_a", _))
            .returns(Ok(archived)),
        CatalogueProviderMock::update_price
            .next_call(matching!("price_b", _))
            .returns(Err(ProviderError::Unavailable)),
    )));
    let failure = archiver(provider, CREATED + HOLD)
        .archive(&catalogue(), true)
        .unwrap_err();
    assert_eq!(
        rendered(failure.lines),
        [
            "price mokly_team_editor_usd_month current price_editor_current",
            "price mokly_team_editor_usd_month archived price_a",
        ]
    );
    assert_eq!(
        failure.error.to_string(),
        "error provider-unavailable operation=price-archive target=price_b"
    );
}

#[test]
fn retrieval_failure_keeps_the_current_line_and_names_the_price_target() {
    let mut current = current_prices(CREATED);
    current[0]
        .metadata
        .insert(REPLACED_PRICE_METADATA.to_owned(), "price_old".to_owned());
    let provider = Arc::new(Unimock::new((
        base_product(),
        lookup_prices(current),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(Vec::new())),
        CatalogueProviderMock::retrieve_price
            .next_call(matching!("price_old"))
            .returns(Err(ProviderError::Unavailable)),
    )));
    let failure = archiver(provider, CREATED + HOLD)
        .archive(&catalogue(), false)
        .unwrap_err();
    assert_eq!(
        rendered(failure.lines),
        ["price mokly_team_editor_usd_month current price_editor_current"]
    );
    assert_eq!(
        failure.error.to_string(),
        "error provider-unavailable operation=retrieve-price target=price_old"
    );
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

fn rendered(lines: Vec<ReportLine>) -> Vec<String> {
    lines.into_iter().map(|line| line.to_string()).collect()
}
