//! Product expansion and forward-compatible catalogue decoding.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

use crate::catalogue::{ExpandableProduct, Product, TaxBehavior};
use crate::objects::Price;

fn price_json(product: serde_json::Value, tax_behavior: &str) -> serde_json::Value {
    json!({
        "id": "price_editor_fixture",
        "created": 1790380800,
        "object": "price",
        "product": product,
        "unit_amount": 2000,
        "currency": "usd",
        "recurring": {"interval": "month", "usage_type": "licensed"},
        "active": true,
        "lookup_key": "mokly_team_editor_usd_month",
        "nickname": "Editor seat",
        "tax_behavior": tax_behavior,
        "metadata": {"mokly_seat_kind": "editor"}
    })
}

#[test]
fn price_decodes_an_unexpanded_product_identifier() {
    let price: Price =
        serde_json::from_value(price_json(json!("prod_team_fixture"), "exclusive")).unwrap();
    assert_eq!(price.product.id(), "prod_team_fixture");
    assert_eq!(price.created, 1_790_380_800);
    assert!(matches!(price.product, ExpandableProduct::Id(_)));
    assert_eq!(price.tax_behavior, Some(TaxBehavior::Exclusive));
    assert_eq!(
        price.lookup_key.as_deref(),
        Some("mokly_team_editor_usd_month")
    );
    assert_eq!(price.nickname.as_deref(), Some("Editor seat"));
    assert_eq!(price.metadata["mokly_seat_kind"], "editor");
}

#[test]
fn price_decodes_an_expanded_product() {
    let product = json!({
        "id": "prod_team_fixture",
        "object": "product",
        "name": "Mokly Team",
        "active": true,
        "created": 1790380800,
        "metadata": {"mokly_lookup_key": "mokly_team"}
    });
    let price: Price = serde_json::from_value(price_json(product, "exclusive")).unwrap();
    let ExpandableProduct::Object(product) = price.product else {
        panic!("product was not expanded");
    };
    assert_eq!(product.name, "Mokly Team");
    assert_eq!(product.metadata["mokly_lookup_key"], "mokly_team");
    assert_eq!(product.extra["object"], "product");
}

#[test]
fn unknown_tax_behavior_decodes_without_becoming_known() {
    let price: Price =
        serde_json::from_value(price_json(json!("prod_team_fixture"), "future_behavior")).unwrap();
    assert_eq!(price.tax_behavior, Some(TaxBehavior::Unknown));
}

#[test]
fn product_decodes_owned_fields_and_retains_provider_drift() {
    let product: Product = serde_json::from_value(json!({
        "id": "prod_team_fixture",
        "name": "Mokly Team",
        "active": false,
        "created": 1790380800,
        "metadata": {"mokly_lookup_key": "mokly_team"},
        "future_field": true
    }))
    .unwrap();
    assert!(!product.active);
    assert_eq!(product.created, 1_790_380_800);
    assert_eq!(product.extra["future_field"], true);
}
