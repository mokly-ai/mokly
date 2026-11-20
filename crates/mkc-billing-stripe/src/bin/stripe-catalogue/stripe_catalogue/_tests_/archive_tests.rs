//! Archive product/current-price resolution and read-only behavior.

use std::sync::Arc;

use mkc_billing_interface::catalogue_provider::CatalogueProviderMock;
use mkc_billing_interface::provider::BillingProviderMock;
use unimock::{MockFn, Unimock, matching};

use super::archive_support::{archiver, current_prices};
use super::fixtures::{catalogue, price, product};
use crate::stripe_catalogue::archive::CatalogueArchive;
use crate::stripe_catalogue::report::ReportLine;

const CREATED: i64 = 1_000;
const AFTER_HOLD: i64 = CREATED + 24 * 60 * 60;

#[test]
fn invalid_identity_fails_before_any_provider_request() {
    let provider = Arc::new(Unimock::new(()));
    let mut invalid = catalogue();
    invalid.product.lookup_key = "invalid";
    let failure = archiver(provider, AFTER_HOLD)
        .archive(&invalid, true)
        .unwrap_err();
    assert!(failure.lines.is_empty());
    assert_eq!(
        failure.error.to_string(),
        "error invalid-catalogue-identity field=lookup-key"
    );
}

#[test]
fn no_candidate_reports_only_current_prices() {
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(current_prices(CREATED))),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(Vec::new())),
    )));
    let lines = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), true)
        .unwrap();
    assert_eq!(
        rendered(lines),
        [
            "price mokly_team_editor_usd_month current price_editor_current",
            "price mokly_team_collaborator_usd_month current price_collaborator_current",
        ]
    );
}

#[test]
fn archived_only_product_fails_without_price_requests_or_writes() {
    let provider = Arc::new(Unimock::new(
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_archived", false, 1)])),
    ));
    let failure = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), true)
        .unwrap_err();
    assert!(failure.lines.is_empty());
    assert_eq!(
        failure.error.to_string(),
        "error missing-product lookup_key=mokly_team"
    );
}

#[test]
fn duplicate_active_products_fail_with_sorted_identifiers() {
    let provider = Arc::new(Unimock::new(
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![
                product("prod_z", true, 1),
                product("prod_a", true, 2),
            ])),
    ));
    let failure = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), false)
        .unwrap_err();
    assert_eq!(
        failure.error.to_string(),
        "error duplicate-active-products lookup_key=mokly_team products=prod_a,prod_z"
    );
}

#[test]
fn missing_current_price_fails_before_the_product_sweep() {
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(Vec::new())),
    )));
    let failure = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), false)
        .unwrap_err();
    assert!(failure.lines.is_empty());
    assert_eq!(
        failure.error.to_string(),
        "error missing-current-price lookup_key=mokly_team_editor_usd_month"
    );
}

#[test]
fn dry_run_reports_a_swept_price_without_issuing_a_write() {
    let mut swept = price(0, "price_swept");
    swept.lookup_key = None;
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(current_prices(CREATED))),
        CatalogueProviderMock::list_product_prices
            .next_call(matching!("prod_team"))
            .returns(Ok(vec![swept])),
    )));
    let lines = archiver(provider, AFTER_HOLD)
        .archive(&catalogue(), false)
        .unwrap();
    assert_eq!(
        rendered(lines),
        [
            "price mokly_team_editor_usd_month current price_editor_current",
            "price mokly_team_editor_usd_month would archive price_swept",
            "price mokly_team_collaborator_usd_month current price_collaborator_current",
        ]
    );
}

fn rendered(lines: Vec<ReportLine>) -> Vec<String> {
    lines.into_iter().map(|line| line.to_string()).collect()
}
