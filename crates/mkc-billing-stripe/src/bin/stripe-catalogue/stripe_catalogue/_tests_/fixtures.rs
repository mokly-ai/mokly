//! Compact provider DTO fixtures shared by catalogue unit tests.

use std::collections::BTreeMap;

use mkc_billing_interface::catalogue::{ExpandableProduct, Product, Recurring, TaxBehavior};
use mkc_billing_interface::catalogue_provider::RunId;
use mkc_billing_interface::objects::Price;
use mkc_domain::billing::{
    CATALOGUE, Catalogue, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA,
};

pub(super) fn catalogue() -> Catalogue {
    CATALOGUE
}

pub(super) fn run() -> RunId {
    RunId::new("0123456789abcdef0123456789abcdef".to_owned()).unwrap()
}

pub(super) fn product(id: &str, active: bool, created: i64) -> Product {
    Product {
        id: id.to_owned(),
        name: CATALOGUE.product.name.to_owned(),
        active,
        created,
        metadata: BTreeMap::from([(
            PRODUCT_LOOKUP_KEY_METADATA.to_owned(),
            CATALOGUE.product.lookup_key.to_owned(),
        )]),
        extra: BTreeMap::new(),
    }
}

pub(super) fn price(index: usize, id: &str) -> Price {
    let seat = &CATALOGUE.seats[index];
    Price {
        id: id.to_owned(),
        created: 1_790_380_800,
        product: ExpandableProduct::Id("prod_team".to_owned()),
        unit_amount: Some(i64::from(seat.unit_amount_cents)),
        currency: CATALOGUE.currency.to_owned(),
        recurring: Some(Recurring {
            interval: CATALOGUE.interval.to_owned(),
            usage_type: CATALOGUE.usage_type.to_owned(),
            extra: BTreeMap::new(),
        }),
        active: true,
        lookup_key: Some(seat.lookup_key.to_owned()),
        nickname: Some(seat.nickname.to_owned()),
        tax_behavior: Some(TaxBehavior::Exclusive),
        metadata: BTreeMap::from([(
            PRICE_SEAT_KIND_METADATA.to_owned(),
            seat.kind.as_str().to_owned(),
        )]),
        extra: BTreeMap::new(),
    }
}
