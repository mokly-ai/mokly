//! Resolved prices must match every catalogue field before becoming visible.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use mkc_billing_interface::catalogue::{ExpandableProduct, Product, Recurring, TaxBehavior};
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProviderMock;
use mkc_domain::billing::{CATALOGUE, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA};
use unimock::{MockFn, Unimock, matching};

use crate::prices::{PriceVerifier, ProviderPriceVerifier, mismatch};

#[test]
fn one_listing_resolves_both_verified_price_identities() {
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!((keys) if *keys == catalogue_keys()))
            .returns(Ok(vec![
                resolved_price(0, "price_resolved_editor", 2_000),
                resolved_price(1, "price_resolved_collaborator", 500),
            ])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert_eq!(
        verified.editor.as_ref().unwrap().id,
        "price_resolved_editor"
    );
    assert_eq!(
        verified.collaborator.as_ref().unwrap().id,
        "price_resolved_collaborator"
    );
    assert!(verified.checkout_available());
}

#[test]
fn mismatched_amount_from_lookup_resolution_is_unverified() {
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![
                resolved_price(0, "price_resolved_editor", 2_001),
                resolved_price(1, "price_resolved_collaborator", 500),
            ])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_some());
    assert!(!verified.checkout_available());
}

#[test]
fn missing_seat_tag_from_lookup_resolution_is_unverified_with_exact_field() {
    let mut editor = resolved_price(0, "price_resolved_editor", 2_000);
    editor.metadata.clear();
    assert_eq!(
        mismatch(&editor, CATALOGUE.seats[0]),
        Err("metadata.mokly_seat_kind")
    );
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![
                editor,
                resolved_price(1, "price_resolved_collaborator", 500),
            ])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_some());
}

#[test]
fn wrong_seat_tag_from_lookup_resolution_is_unverified_with_exact_field() {
    let mut editor = resolved_price(0, "price_resolved_editor", 2_000);
    editor.metadata.insert(
        PRICE_SEAT_KIND_METADATA.to_owned(),
        CATALOGUE.seats[1].kind.as_str().to_owned(),
    );
    assert_eq!(
        mismatch(&editor, CATALOGUE.seats[0]),
        Err("metadata.mokly_seat_kind")
    );
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![
                editor,
                resolved_price(1, "price_resolved_collaborator", 500),
            ])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_some());
}

#[test]
fn missing_lookup_key_disables_checkout_without_hiding_the_other_price() {
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![resolved_price(
                1,
                "price_resolved_collaborator",
                500,
            )])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_some());
    assert!(!verified.checkout_available());
    assert!(verified.identities().is_none());
}

#[test]
fn distinct_team_products_leave_both_prices_unverified() {
    let mut collaborator = resolved_price(1, "price_resolved_collaborator", 500);
    let ExpandableProduct::Object(product) = &mut collaborator.product else {
        panic!("fixture product was not expanded");
    };
    product.id = "prod_duplicate_team".into();
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Ok(vec![
                resolved_price(0, "price_resolved_editor", 2_000),
                collaborator,
            ])),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_none());
}

#[test]
fn rate_limited_listing_is_unavailable_without_a_retry() {
    let provider = Unimock::new(
        BillingProviderMock::list_prices_by_lookup_keys
            .next_call(matching!(_))
            .returns(Err(ProviderError::RateLimited {
                retry_after: 60,
                detail: ProviderDetail::none(),
            })),
    );
    let verified = ProviderPriceVerifier {
        provider: Arc::new(provider),
    }
    .verify();
    assert!(verified.editor.is_none());
    assert!(verified.collaborator.is_none());
}

fn catalogue_keys() -> Vec<String> {
    CATALOGUE
        .seats
        .iter()
        .map(|seat| seat.lookup_key.to_owned())
        .collect()
}

fn resolved_price(seat: usize, id: &str, unit_amount: i64) -> Price {
    let expected = CATALOGUE.seats[seat];
    Price {
        id: id.into(),
        created: 1_790_380_800,
        product: ExpandableProduct::Object(Product {
            id: "prod_team_fixture".into(),
            name: CATALOGUE.product.name.into(),
            active: true,
            created: 1_790_380_800,
            metadata: BTreeMap::from([(
                PRODUCT_LOOKUP_KEY_METADATA.into(),
                CATALOGUE.product.lookup_key.into(),
            )]),
            extra: BTreeMap::new(),
        }),
        unit_amount: Some(unit_amount),
        currency: CATALOGUE.currency.into(),
        recurring: Some(Recurring {
            interval: CATALOGUE.interval.into(),
            usage_type: CATALOGUE.usage_type.into(),
            extra: BTreeMap::new(),
        }),
        active: true,
        lookup_key: Some(expected.lookup_key.into()),
        nickname: Some(expected.nickname.into()),
        tax_behavior: Some(TaxBehavior::Exclusive),
        metadata: BTreeMap::from([(
            PRICE_SEAT_KIND_METADATA.to_owned(),
            expected.kind.as_str().to_owned(),
        )]),
        extra: BTreeMap::new(),
    }
}
