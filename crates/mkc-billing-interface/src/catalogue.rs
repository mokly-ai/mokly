//! Stripe catalogue objects that products and prices share.

use std::collections::BTreeMap;

use serde::Deserialize;
use serde_json::Value;

/// Stripe tax behavior values known to the pinned API version.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaxBehavior {
    /// Tax is added to the price amount.
    Exclusive,
    /// Tax is included in the price amount.
    Inclusive,
    /// The Stripe account default determines tax treatment.
    Unspecified,
    /// A value introduced after the pinned contract.
    #[serde(other)]
    Unknown,
}

/// Recurrence terms attached to a Stripe price.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Recurring {
    /// Billing interval, such as `month`.
    pub interval: String,
    /// Usage type, such as `licensed`.
    pub usage_type: String,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Stripe product owned or inspected by catalogue reconciliation.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Product {
    /// Stable Stripe product identifier.
    pub id: String,
    /// Customer-facing product name.
    pub name: String,
    /// Whether Stripe permits the product to be used for new purchases.
    pub active: bool,
    /// Provider creation time as Unix seconds.
    pub created: i64,
    /// Catalogue identity metadata.
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    /// Forward-compatible fields not yet modeled by this API version.
    #[serde(flatten)]
    pub extra: BTreeMap<String, Value>,
}

/// Stripe expandable product relation.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ExpandableProduct {
    /// Unexpanded product identifier.
    Id(String),
    /// Expanded product object.
    Object(Product),
}

impl ExpandableProduct {
    /// Return the stable product identifier in either representation.
    pub fn id(&self) -> &str {
        match self {
            Self::Id(id) => id,
            Self::Object(product) => &product.id,
        }
    }
}

#[cfg(test)]
#[path = "_tests_/catalogue_tests.rs"]
mod tests;
