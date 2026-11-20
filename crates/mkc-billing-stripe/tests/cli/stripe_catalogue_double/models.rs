//! Product and price records used by the stateful Stripe double.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use mkc_domain::billing::CATALOGUE;
use serde_json::{Value, json};

#[derive(Clone)]
pub(super) struct Product {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) active: bool,
    pub(super) created: i64,
}

#[derive(Clone)]
pub(super) struct Price {
    pub(super) id: String,
    pub(super) created: i64,
    pub(super) product: String,
    pub(super) unit_amount: i64,
    pub(super) currency: String,
    pub(super) interval: String,
    pub(super) usage_type: String,
    pub(super) active: bool,
    pub(super) lookup_key: Option<String>,
    pub(super) nickname: String,
    pub(super) tax_behavior: String,
    pub(super) metadata: BTreeMap<String, String>,
}

pub(super) struct NewPrice {
    pub(super) product: String,
    pub(super) unit_amount: i64,
    pub(super) currency: String,
    pub(super) interval: String,
    pub(super) usage_type: String,
    pub(super) lookup_key: String,
    pub(super) nickname: String,
    pub(super) tax_behavior: String,
    pub(super) metadata: BTreeMap<String, String>,
}

pub(super) fn catalogue_product(id: &str, created: i64) -> Product {
    Product {
        id: id.to_owned(),
        name: CATALOGUE.product.name.to_owned(),
        active: true,
        created,
    }
}

pub(super) fn catalogue_price(index: usize, id: &str, unit_amount: i64, created: i64) -> Price {
    let seat = &CATALOGUE.seats[index];
    Price {
        id: id.to_owned(),
        created,
        product: "prod_team".to_owned(),
        unit_amount,
        currency: CATALOGUE.currency.to_owned(),
        interval: CATALOGUE.interval.to_owned(),
        usage_type: CATALOGUE.usage_type.to_owned(),
        active: true,
        lookup_key: Some(seat.lookup_key.to_owned()),
        nickname: seat.nickname.to_owned(),
        tax_behavior: seat.tax_behavior.as_str().to_owned(),
        metadata: BTreeMap::from([("mokly_seat_kind".to_owned(), seat.kind.as_str().to_owned())]),
    }
}

pub(super) fn product_json(product: &Product) -> Value {
    json!({
        "id": product.id,
        "object": "product",
        "name": product.name,
        "active": product.active,
        "created": product.created,
        "metadata": {"mokly_lookup_key": CATALOGUE.product.lookup_key}
    })
}

pub(super) fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}
