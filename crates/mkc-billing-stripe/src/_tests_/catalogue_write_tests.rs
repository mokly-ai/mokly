//! Catalogue writes sort exact forms and derive operation-specific replay keys.

use std::collections::BTreeMap;

use mkc_billing_interface::catalogue::TaxBehavior;
use mkc_billing_interface::catalogue_provider::{
    CatalogueProvider, CreatePrice, CreateProduct, RunId, UpdatePrice, UpdateProduct,
};
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::Method;

use super::fixtures::{client, expected, recorded, response};

const PRODUCT_HASH: &str = "036c14fef76fba28dc624f564705bf44";
const PRICE_HASH: &str = "561cc9dc5ca60c82a036e11d86d70e69";
const PRICE_UPDATE_HASH: &str = "608e2eb50d716ea20702f2f1b782ce85";
const PRICE_ARCHIVE_HASH: &str = "28055bae64c6d29aedaab556ac4b478a";
const RUN: &str = "0123456789abcdef0123456789abcdef";

fn run() -> RunId {
    RunId::new(RUN.to_owned()).unwrap()
}

fn product_metadata() -> BTreeMap<String, String> {
    BTreeMap::from([("mokly_lookup_key".to_owned(), "mokly_team".to_owned())])
}

fn price_metadata() -> BTreeMap<String, String> {
    BTreeMap::from([("mokly_seat_kind".to_owned(), "editor".to_owned())])
}

fn price_input(replaces: Option<&str>) -> CreatePrice {
    CreatePrice {
        run: run(),
        product: "prod_team_fixture".to_owned(),
        currency: "usd".to_owned(),
        unit_amount: 2_000,
        interval: "month".to_owned(),
        usage_type: "licensed".to_owned(),
        tax_behavior: TaxBehavior::Exclusive,
        lookup_key: "mokly_team_editor_usd_month".to_owned(),
        nickname: "Editor seat".to_owned(),
        metadata: price_metadata(),
        replaces: replaces.map(str::to_owned),
    }
}

fn product_form() -> Vec<(&'static str, &'static str)> {
    vec![
        ("active", "true"),
        ("metadata[mokly_lookup_key]", "mokly_team"),
        ("name", "Mokly Team"),
    ]
}

fn price_form() -> Vec<(&'static str, &'static str)> {
    vec![
        ("currency", "usd"),
        ("lookup_key", "mokly_team_editor_usd_month"),
        ("metadata[mokly_seat_kind]", "editor"),
        ("nickname", "Editor seat"),
        ("product", "prod_team_fixture"),
        ("recurring[interval]", "month"),
        ("recurring[usage_type]", "licensed"),
        ("tax_behavior", "exclusive"),
        ("transfer_lookup_key", "true"),
        ("unit_amount", "2000"),
    ]
}

#[test]
fn writes_use_sorted_forms_and_body_derived_keys() {
    let stripe = client(recorded(vec![
        (
            expected(
                Method::Post,
                "/v1/products",
                Some(&format!(
                    "mokly-catalogue:{RUN}:product-create:mokly_team:{PRODUCT_HASH}"
                )),
                product_form(),
            ),
            response("product-created"),
        ),
        (
            expected(
                Method::Post,
                "/v1/products/prod_team_archived_fixture",
                Some(&format!(
                    "mokly-catalogue:{RUN}:product-update:prod_team_archived_fixture:{PRODUCT_HASH}"
                )),
                product_form(),
            ),
            response("product-updated"),
        ),
        (
            expected(
                Method::Post,
                "/v1/prices",
                Some(&format!(
                    "mokly-catalogue:{RUN}:price-create:mokly_team_editor_usd_month:{PRICE_HASH}"
                )),
                price_form(),
            ),
            response("price-created"),
        ),
        (
            expected(
                Method::Post,
                "/v1/prices",
                Some(&format!(
                    "mokly-catalogue:{RUN}:price-replace:price_editor_fixture:{PRICE_HASH}"
                )),
                price_form(),
            ),
            response("price-created"),
        ),
        (
            expected(
                Method::Post,
                "/v1/prices/price_editor_fixture",
                Some(&format!(
                    "mokly-catalogue:{RUN}:price-update:price_editor_fixture:{PRICE_UPDATE_HASH}"
                )),
                vec![
                    ("metadata[mokly_seat_kind]", "editor"),
                    ("nickname", "Editor seat"),
                ],
            ),
            response("price-updated"),
        ),
        (
            expected(
                Method::Post,
                "/v1/prices/price_editor_fixture",
                Some(&format!(
                    "mokly-catalogue:{RUN}:price-archive:price_editor_fixture:{PRICE_ARCHIVE_HASH}"
                )),
                vec![("active", "false")],
            ),
            response("price-archived"),
        ),
    ]));

    let created = stripe
        .create_product(&CreateProduct {
            run: run(),
            lookup_key: "mokly_team".to_owned(),
            name: "Mokly Team".to_owned(),
            metadata: product_metadata(),
        })
        .unwrap();
    assert_eq!(created.id, "prod_created_fixture");
    let updated = stripe
        .update_product(
            "prod_team_archived_fixture",
            &UpdateProduct {
                run: run(),
                name: "Mokly Team".to_owned(),
                active: true,
                metadata: product_metadata(),
            },
        )
        .unwrap();
    assert!(updated.active);
    assert_eq!(
        stripe.create_price(&price_input(None)).unwrap().unit_amount,
        Some(2_000)
    );
    assert_eq!(
        stripe
            .create_price(&price_input(Some("price_editor_fixture")))
            .unwrap()
            .product
            .id(),
        "prod_team_fixture"
    );
    let mutable = UpdatePrice {
        run: run(),
        nickname: Some("Editor seat".to_owned()),
        metadata: price_metadata(),
        active: None,
    };
    assert!(
        stripe
            .update_price("price_editor_fixture", &mutable)
            .unwrap()
            .active
    );
    let archive = UpdatePrice {
        run: run(),
        nickname: None,
        metadata: BTreeMap::new(),
        active: Some(false),
    };
    assert!(
        !stripe
            .update_price("price_editor_fixture", &archive)
            .unwrap()
            .active
    );
}

#[test]
fn invalid_catalogue_writes_fail_before_sending() {
    let stripe = client(unimock::Unimock::new(()));
    let mut invalid_price = price_input(None);
    invalid_price.tax_behavior = TaxBehavior::Unknown;
    assert!(matches!(
        stripe.create_price(&invalid_price),
        Err(Error::InvalidRequest { .. })
    ));
    assert!(matches!(
        stripe.update_price(
            "price_editor_fixture",
            &UpdatePrice {
                run: run(),
                nickname: None,
                metadata: BTreeMap::new(),
                active: None,
            }
        ),
        Err(Error::InvalidRequest { .. })
    ));
    assert!(matches!(
        stripe.update_product(
            "../product",
            &UpdateProduct {
                run: run(),
                name: "Mokly Team".to_owned(),
                active: true,
                metadata: product_metadata(),
            }
        ),
        Err(Error::InvalidRequest { .. })
    ));
}
