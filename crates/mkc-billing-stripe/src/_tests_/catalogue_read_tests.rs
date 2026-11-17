//! Catalogue reads include archived products and follow exact cursors.

use mkc_billing_interface::catalogue_provider::CatalogueProvider;
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::Method;

use super::fixtures::{client, expected, recorded, response};

#[test]
fn products_paginate_across_active_and_archived_objects() {
    let stripe = client(recorded(vec![
        (
            expected(Method::Get, "/v1/products", None, vec![("limit", "100")]),
            response("products-page"),
        ),
        (
            expected(
                Method::Get,
                "/v1/products",
                None,
                vec![("limit", "100"), ("starting_after", "prod_team_fixture")],
            ),
            response("products-page-last"),
        ),
    ]));
    let products = stripe.list_products().unwrap();
    assert_eq!(products.len(), 2);
    assert!(products[0].active);
    assert!(!products[1].active);
    assert_eq!(products[1].id, "prod_team_archived_fixture");
}

#[test]
fn product_prices_paginate_with_the_last_price_cursor() {
    let stripe = client(recorded(vec![
        (
            expected(
                Method::Get,
                "/v1/prices",
                None,
                vec![
                    ("product", "prod_team_fixture"),
                    ("active", "true"),
                    ("limit", "100"),
                ],
            ),
            response("product-prices-page"),
        ),
        (
            expected(
                Method::Get,
                "/v1/prices",
                None,
                vec![
                    ("product", "prod_team_fixture"),
                    ("active", "true"),
                    ("limit", "100"),
                    ("starting_after", "price_legacy_editor_fixture"),
                ],
            ),
            response("product-prices-page-last"),
        ),
    ]));
    let prices = stripe.list_product_prices("prod_team_fixture").unwrap();
    assert_eq!(prices.len(), 2);
    assert_eq!(prices[0].lookup_key, None);
    assert_eq!(prices[0].metadata["mokly_seat_kind"], "editor");
    assert_eq!(prices[1].id, "price_unmanaged_fixture");
}

#[test]
fn price_retrieval_uses_one_unkeyed_path_read() {
    let stripe = client(recorded(vec![(
        expected(
            Method::Get,
            "/v1/prices/price_legacy_editor_fixture",
            None,
            Vec::new(),
        ),
        response("price-retrieved"),
    )]));
    let price = stripe
        .retrieve_price("price_legacy_editor_fixture")
        .unwrap();
    assert_eq!(price.id, "price_legacy_editor_fixture");
    assert_eq!(price.created, 1_790_380_800);
    assert_eq!(price.lookup_key, None);
}

#[test]
fn invalid_product_identifier_fails_before_sending() {
    let stripe = client(unimock::Unimock::new(()));
    assert!(matches!(
        stripe.list_product_prices("../products"),
        Err(Error::InvalidRequest { .. })
    ));
    assert!(matches!(
        stripe.retrieve_price("../prices"),
        Err(Error::InvalidRequest { .. })
    ));
}
