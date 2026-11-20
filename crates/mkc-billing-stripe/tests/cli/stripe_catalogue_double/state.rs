//! Mutable Stripe catalogue state and response objects for CLI tests.

use std::collections::BTreeMap;

use serde_json::{Value, json};

use mkc_domain::billing::{CATALOGUE, PRICE_SEAT_KIND_METADATA};

use super::StripeResponse;
use super::models::{
    NewPrice, Price, Product, catalogue_price, catalogue_product, product_json, unix_now,
};

#[derive(Clone, Debug)]
pub(crate) struct Call {
    pub(crate) method: String,
    pub(crate) url: String,
    pub(crate) idempotency_key: Option<String>,
    pub(crate) body: String,
}

#[derive(Default)]
pub(super) struct State {
    products: Vec<Product>,
    pub(super) prices: Vec<Price>,
    next_product: usize,
    next_price: usize,
    next_price_created: Option<i64>,
    idempotency: BTreeMap<String, StripeResponse>,
    queued_write_response: Option<StripeResponse>,
    pub(super) calls: Vec<Call>,
    pub(super) failures: Vec<String>,
}

impl State {
    pub(super) fn seed_catalogue(&mut self, editor_id: &str, editor_amount: i64) {
        self.products = vec![catalogue_product("prod_team", 1)];
        let created = unix_now();
        self.prices = vec![
            catalogue_price(0, editor_id, editor_amount, created),
            catalogue_price(
                1,
                "price_collaborator",
                i64::from(CATALOGUE.seats[1].unit_amount_cents),
                created,
            ),
        ];
    }

    pub(super) fn seed_catalogue_without_editor_tag(
        &mut self,
        editor_id: &str,
        editor_amount: i64,
    ) {
        self.seed_catalogue(editor_id, editor_amount);
        if let Some(editor) = self.prices.iter_mut().find(|price| price.id == editor_id) {
            editor.metadata.remove(PRICE_SEAT_KIND_METADATA);
        }
    }

    pub(super) fn seed_keyless_editor(&mut self, id: &str) {
        let mut price = catalogue_price(
            0,
            id,
            i64::from(CATALOGUE.seats[0].unit_amount_cents),
            unix_now() - 25 * 60 * 60,
        );
        price.lookup_key = None;
        self.prices.push(price);
    }

    pub(super) fn seed_product_only(&mut self) {
        self.products = vec![catalogue_product("prod_team", 1)];
        self.prices.clear();
    }

    pub(super) fn seed_cross_product_chain(&mut self) {
        self.seed_catalogue(
            "price_editor_current",
            i64::from(CATALOGUE.seats[0].unit_amount_cents),
        );
        self.set_price_created("price_editor_current", unix_now() - 25 * 60 * 60);
        if let Some(current) = self
            .prices
            .iter_mut()
            .find(|price| price.id == "price_editor_current")
        {
            current.metadata.insert(
                "mokly_replaces".to_owned(),
                "price_editor_middle".to_owned(),
            );
        }
        let mut middle = catalogue_price(
            0,
            "price_editor_middle",
            i64::from(CATALOGUE.seats[0].unit_amount_cents),
            unix_now() - 26 * 60 * 60,
        );
        middle.lookup_key = None;
        middle.metadata.insert(
            "mokly_replaces".to_owned(),
            "price_editor_oldest".to_owned(),
        );
        let mut oldest = catalogue_price(
            0,
            "price_editor_oldest",
            i64::from(CATALOGUE.seats[0].unit_amount_cents),
            unix_now() - 27 * 60 * 60,
        );
        oldest.product = "prod_other".to_owned();
        oldest.lookup_key = None;
        oldest.metadata.clear();
        self.prices.extend([middle, oldest]);
    }

    pub(super) fn set_price_created(&mut self, id: &str, created: i64) {
        if let Some(price) = self.prices.iter_mut().find(|price| price.id == id) {
            price.created = created;
        }
    }

    pub(super) fn set_next_price_created(&mut self, created: i64) {
        self.next_price_created = Some(created);
    }

    pub(super) fn archive_product(&mut self) {
        if let Some(product) = self.products.first_mut() {
            product.active = false;
        }
    }

    pub(super) fn price_active(&self, id: &str) -> bool {
        self.prices
            .iter()
            .find(|price| price.id == id)
            .is_some_and(|price| price.active)
    }

    pub(super) fn product_active(&self) -> bool {
        self.products.first().is_some_and(|product| product.active)
    }

    pub(super) fn replay(&self, key: &str) -> Option<StripeResponse> {
        self.idempotency.get(key).cloned()
    }

    pub(super) fn remember(&mut self, key: &str, response: StripeResponse) {
        self.idempotency.insert(key.to_owned(), response);
    }

    pub(super) fn queue_write_response(&mut self, response: StripeResponse) {
        self.queued_write_response = Some(response);
    }

    pub(super) fn take_queued_write_response(&mut self) -> Option<StripeResponse> {
        self.queued_write_response.take()
    }

    pub(super) fn products_body(&self) -> Value {
        list(self.products.iter().map(product_json).collect())
    }

    pub(super) fn lookup_prices_body(&self) -> Result<Value, String> {
        let mut data = Vec::new();
        for price in self.prices.iter().filter(|price| {
            price.active
                && price
                    .lookup_key
                    .as_deref()
                    .is_some_and(|key| CATALOGUE.seats.iter().any(|seat| seat.lookup_key == key))
        }) {
            data.push(self.price_json(price, true)?);
        }
        Ok(list(data))
    }

    pub(super) fn product_prices_body(&self, product: &str) -> Result<Value, String> {
        let mut data = Vec::new();
        for price in self
            .prices
            .iter()
            .filter(|price| price.active && price.product == product)
        {
            data.push(self.price_json(price, false)?);
        }
        Ok(list(data))
    }

    pub(super) fn price_body(&self, id: &str) -> Result<Option<Value>, String> {
        self.prices
            .iter()
            .find(|price| price.id == id)
            .map(|price| self.price_json(price, false))
            .transpose()
    }

    pub(super) fn create_product(&mut self, name: &str) -> Value {
        self.next_product += 1;
        let product = catalogue_product(&format!("prod_created_{}", self.next_product), 100);
        let product = Product {
            name: name.to_owned(),
            ..product
        };
        let body = product_json(&product);
        self.products.push(product);
        body
    }

    pub(super) fn update_product(&mut self, id: &str, name: &str) -> Result<Value, String> {
        let Some(product) = self.products.iter_mut().find(|product| product.id == id) else {
            return Err(format!("unknown product update target {id}"));
        };
        product.name = name.to_owned();
        product.active = true;
        Ok(product_json(product))
    }

    pub(super) fn lookup_holder(&self, lookup_key: &str) -> Option<String> {
        self.prices
            .iter()
            .find(|price| price.active && price.lookup_key.as_deref() == Some(lookup_key))
            .map(|price| price.id.clone())
    }

    pub(super) fn create_price(&mut self, input: NewPrice) -> Result<Value, String> {
        for price in &mut self.prices {
            if price.lookup_key.as_deref() == Some(&input.lookup_key) {
                price.lookup_key = None;
            }
        }
        self.next_price += 1;
        let price = Price {
            id: format!("price_created_{}", self.next_price),
            created: self.next_price_created.take().unwrap_or_else(unix_now),
            product: input.product,
            unit_amount: input.unit_amount,
            currency: input.currency,
            interval: input.interval,
            usage_type: input.usage_type,
            active: true,
            lookup_key: Some(input.lookup_key),
            nickname: input.nickname,
            tax_behavior: input.tax_behavior,
            metadata: input.metadata,
        };
        let body = self.price_json(&price, false)?;
        self.prices.push(price);
        Ok(body)
    }

    pub(super) fn price_json(&self, price: &Price, expand_product: bool) -> Result<Value, String> {
        let product = if expand_product {
            let Some(product) = self
                .products
                .iter()
                .find(|product| product.id == price.product)
            else {
                return Err(format!("missing expanded product {}", price.product));
            };
            product_json(product)
        } else {
            json!(price.product)
        };
        Ok(json!({
            "id": price.id,
            "object": "price",
            "created": price.created,
            "product": product,
            "unit_amount": price.unit_amount,
            "currency": price.currency,
            "recurring": {"interval": price.interval, "usage_type": price.usage_type},
            "active": price.active,
            "lookup_key": price.lookup_key,
            "nickname": price.nickname,
            "tax_behavior": price.tax_behavior,
            "metadata": price.metadata
        }))
    }
}

fn list(data: Vec<Value>) -> Value {
    json!({"object": "list", "data": data, "has_more": false})
}
