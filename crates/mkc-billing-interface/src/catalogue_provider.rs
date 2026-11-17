//! Product and price operations used by Stripe catalogue reconciliation.

use std::collections::BTreeMap;

use crate::catalogue::{Product, TaxBehavior};
use crate::error::{Error, ProviderDetail, Result};
use crate::objects::Price;

/// Random identifier shared by all catalogue writes in one command invocation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunId(String);

impl RunId {
    /// Validate exactly 128 bits rendered as 32 lowercase hexadecimal characters.
    pub fn new(value: String) -> Result<Self> {
        if value.len() != 32
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(Error::InvalidRequest {
                detail: ProviderDetail::none(),
            });
        }
        Ok(Self(value))
    }

    /// Borrow the validated lowercase hexadecimal identifier.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Complete input for creating an active catalogue product.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreateProduct {
    /// Invocation identifier used to scope provider idempotency.
    pub run: RunId,
    /// Stable product lookup key used as the write's idempotency target.
    pub lookup_key: String,
    /// Customer-facing Stripe product name.
    pub name: String,
    /// Complete catalogue-owned product metadata.
    pub metadata: BTreeMap<String, String>,
}

/// Complete catalogue-owned fields for updating a product.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UpdateProduct {
    /// Invocation identifier used to scope provider idempotency.
    pub run: RunId,
    /// Customer-facing Stripe product name.
    pub name: String,
    /// Whether the product accepts new purchases.
    pub active: bool,
    /// Complete catalogue-owned product metadata.
    pub metadata: BTreeMap<String, String>,
}

/// Complete immutable and mutable fields for creating a recurring price.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreatePrice {
    /// Invocation identifier used to scope provider idempotency.
    pub run: RunId,
    /// Product identifier that owns the price.
    pub product: String,
    /// Lowercase ISO currency code.
    pub currency: String,
    /// Amount in the currency's minor unit.
    pub unit_amount: i64,
    /// Recurring interval such as `month`.
    pub interval: String,
    /// Recurring usage type such as `licensed`.
    pub usage_type: String,
    /// Tax treatment fixed for the price.
    pub tax_behavior: TaxBehavior,
    /// Stable Stripe lookup key transferred to this price.
    pub lookup_key: String,
    /// Operator-facing price description.
    pub nickname: String,
    /// Complete catalogue-owned price metadata.
    pub metadata: BTreeMap<String, String>,
    /// Existing price being replaced, when replacement selects the write key.
    pub replaces: Option<String>,
}

/// Mutable Stripe price fields; omitted fields remain unchanged.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UpdatePrice {
    /// Invocation identifier used to scope provider idempotency.
    pub run: RunId,
    /// Replacement operator-facing description when present.
    pub nickname: Option<String>,
    /// Catalogue-owned metadata entries to set.
    pub metadata: BTreeMap<String, String>,
    /// Purchase availability when it must change.
    pub active: Option<bool>,
}

/// Stripe product and price behavior consumed by catalogue reconciliation.
#[unimock::unimock(api = CatalogueProviderMock)]
pub trait CatalogueProvider: Send + Sync {
    /// List active and archived products, following at most 100 pages.
    fn list_products(&self) -> Result<Vec<Product>>;
    /// List one product's active prices, following at most 100 pages.
    fn list_product_prices(&self, product: &str) -> Result<Vec<Price>>;
    /// Retrieve one price by its stable provider identifier.
    fn retrieve_price(&self, id: &str) -> Result<Price>;
    /// Create one active product with complete catalogue-owned fields.
    fn create_product(&self, input: &CreateProduct) -> Result<Product>;
    /// Update one product with complete catalogue-owned fields.
    fn update_product(&self, product: &str, input: &UpdateProduct) -> Result<Product>;
    /// Create one recurring price and atomically transfer its lookup key.
    fn create_price(&self, input: &CreatePrice) -> Result<Price>;
    /// Update mutable price fields or archive a price with only `active=false`.
    fn update_price(&self, price: &str, input: &UpdatePrice) -> Result<Price>;
}

#[cfg(test)]
#[path = "_tests_/catalogue_provider_tests.rs"]
mod tests;
