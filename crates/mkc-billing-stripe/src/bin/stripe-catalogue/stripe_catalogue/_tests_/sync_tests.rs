//! Reconciliation behavior at mocked provider boundaries.

use std::sync::Arc;

use mkc_billing_interface::catalogue_provider::{CatalogueProvider, CatalogueProviderMock};
use mkc_billing_interface::error::Error as ProviderError;
use mkc_billing_interface::provider::{BillingProvider, BillingProviderMock};
use mkc_domain::values::Plan;
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{catalogue, price, product, run};
use crate::stripe_catalogue::report::{ObjectAction, PriceAction, ReportLine};
use crate::stripe_catalogue::run_ids::{RunIds, RunIdsMock};
use crate::stripe_catalogue::sync::{CatalogueSync, ProviderCatalogueSync, check};

#[test]
fn offline_check_maps_each_identity_violation_to_a_typed_field() {
    let mut invalid_key = catalogue();
    invalid_key.product.lookup_key = "invalid";
    let mut duplicate_key = catalogue();
    duplicate_key.seats[1].lookup_key = duplicate_key.seats[0].lookup_key;
    let mut wrong_plan = catalogue();
    wrong_plan.product.plan = Plan::Free;
    let mut empty_name = catalogue();
    empty_name.product.name = "";
    let mut empty_nickname = catalogue();
    empty_nickname.seats[0].nickname = "";
    for (catalogue, field) in [
        (invalid_key, "lookup-key"),
        (duplicate_key, "lookup-key"),
        (wrong_plan, "product.plan"),
        (empty_name, "product.name"),
        (empty_nickname, "price.nickname"),
    ] {
        let error = check(&catalogue).unwrap_err();
        assert_eq!(
            error.to_string(),
            format!("error invalid-catalogue-identity field={field}")
        );
    }
}

#[test]
fn dry_run_on_an_empty_account_performs_only_the_two_reads() {
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(Vec::new())),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(Vec::new())),
    )));
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = provider.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = provider;
    let result = ProviderCatalogueSync {
        catalogue_provider,
        billing_provider,
        run_ids: fixed_run_ids(),
    }
    .sync(&catalogue(), false)
    .unwrap();
    assert_eq!(result.len(), 3);
    assert!(matches!(
        &result[0],
        ReportLine::Product {
            action: ObjectAction::WouldCreate,
            ..
        }
    ));
    assert!(result[1..].iter().all(|line| matches!(
        line,
        ReportLine::Price {
            action: PriceAction::Object(ObjectAction::WouldCreate),
            ..
        }
    )));
}

#[test]
fn dry_run_on_existing_objects_performs_only_catalogue_reads() {
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![
                price(0, "price_editor"),
                price(1, "price_collaborator"),
            ])),
    )));
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = provider.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = provider;
    let lines = ProviderCatalogueSync {
        catalogue_provider,
        billing_provider,
        run_ids: fixed_run_ids(),
    }
    .sync(&catalogue(), false)
    .unwrap();
    assert_eq!(lines.len(), 3);
    assert!(
        lines
            .iter()
            .all(|line| line.to_string().contains("validated"))
    );
}

#[test]
fn replacement_creates_one_linked_price_and_never_archives_the_predecessor() {
    let mut old = price(0, "price_old");
    old.unit_amount = Some(1_999);
    let replacement = price(0, "price_new");
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![old, price(1, "price_collaborator")])),
        CatalogueProviderMock::create_price
            .next_call(matching!((input) if
                input.replaces.as_deref() == Some("price_old")
                    && input.metadata.get("mokly_replaces").map(String::as_str)
                        == Some("price_old")
                    && input.metadata.get("mokly_seat_kind").map(String::as_str)
                        == Some("editor")
            ))
            .returns(Ok(replacement)),
    )));
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = provider.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = provider;
    let lines = ProviderCatalogueSync {
        catalogue_provider,
        billing_provider,
        run_ids: fixed_run_ids(),
    }
    .sync(&catalogue(), true)
    .unwrap();
    assert_eq!(
        lines.iter().map(ToString::to_string).collect::<Vec<_>>(),
        [
            "product mokly_team validated prod_team",
            "price mokly_team_editor_usd_month replaced price_old -> price_new",
            "price mokly_team_collaborator_usd_month validated price_collaborator",
        ]
    );
}

#[test]
fn a_provider_failure_keeps_previously_completed_lines() {
    let provider = Arc::new(Unimock::new((
        CatalogueProviderMock::list_products
            .next_call(matching!())
            .returns(Ok(vec![product("prod_team", true, 1)])),
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Err(ProviderError::Unavailable)),
    )));
    let catalogue_provider: Arc<dyn CatalogueProvider + Send + Sync> = provider.clone();
    let billing_provider: Arc<dyn BillingProvider + Send + Sync> = provider;
    let failure = ProviderCatalogueSync {
        catalogue_provider,
        billing_provider,
        run_ids: fixed_run_ids(),
    }
    .sync(&catalogue(), false)
    .unwrap_err();
    assert_eq!(failure.lines.len(), 1);
    assert_eq!(
        failure.error.to_string(),
        "error provider-unavailable operation=list-prices target=catalogue"
    );
}

fn fixed_run_ids() -> Arc<dyn RunIds + Send + Sync> {
    Arc::new(Unimock::new(
        RunIdsMock::next.next_call(matching!()).returns(Ok(run())),
    ))
}
