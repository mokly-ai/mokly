//! Startup resolution and verification of Stripe prices against the plan catalogue.

use std::sync::Arc;

use mkc_billing_interface::catalogue::{ExpandableProduct, TaxBehavior};
use mkc_billing_interface::objects::Price;
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::billing::{
    CATALOGUE, PRICE_SEAT_KIND_METADATA, PRODUCT_LOOKUP_KEY_METADATA, SeatPrice,
    TaxBehavior as CatalogueTaxBehavior,
};

/// Catalogue prices whose resolved provider objects passed every integrity check.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct VerifiedPrices {
    /// Verified Editor price, or `None` when unavailable or mismatched.
    pub editor: Option<VerifiedPrice>,
    /// Verified Collaborator price, or `None` when unavailable or mismatched.
    pub collaborator: Option<VerifiedPrice>,
}

impl VerifiedPrices {
    /// Whether Checkout may use both resolved prices.
    pub fn checkout_available(&self) -> bool {
        self.editor.is_some() && self.collaborator.is_some()
    }

    /// Verified identities safe for price-bearing provider writes.
    pub fn identities(&self) -> Option<VerifiedPriceIds> {
        Some(VerifiedPriceIds {
            editor: self.editor.as_ref()?.id.clone(),
            collaborator: self.collaborator.as_ref()?.id.clone(),
        })
    }
}

/// One resolved provider identity paired with its verified catalogue facts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VerifiedPrice {
    /// Provider identity that passed verification.
    pub id: String,
    /// Catalogue facts the provider object matched.
    pub catalogue: SeatPrice,
}

/// Both verified provider price identities required by billing writers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VerifiedPriceIds {
    /// Verified Editor price identity.
    pub editor: String,
    /// Verified Collaborator price identity.
    pub collaborator: String,
}

/// One-shot price integrity boundary run during application composition.
#[unimock::unimock(api = PriceVerifierMock)]
pub trait PriceVerifier: Send + Sync {
    /// Resolve and verify both catalogue prices without preventing startup.
    fn verify(&self) -> VerifiedPrices;
}

/// Provider-backed verifier for the two catalogue seat prices.
pub struct ProviderPriceVerifier {
    /// Billing provider used for the single lookup-key listing.
    pub provider: Arc<dyn BillingProvider>,
}

impl PriceVerifier for ProviderPriceVerifier {
    fn verify(&self) -> VerifiedPrices {
        let lookup_keys = CATALOGUE
            .seats
            .iter()
            .map(|seat| seat.lookup_key.to_owned())
            .collect::<Vec<_>>();
        let prices = match self.provider.list_prices_by_lookup_keys(&lookup_keys) {
            Ok(prices) => prices,
            Err(error) => {
                for seat in CATALOGUE.seats {
                    tracing::error!(
                        lookup_key = seat.lookup_key,
                        field = "provider",
                        error = %error,
                        "billing price verification failed"
                    );
                }
                return VerifiedPrices::default();
            }
        };
        let editor = verify_one(&prices, CATALOGUE.seats[0]);
        let collaborator = verify_one(&prices, CATALOGUE.seats[1]);
        let (editor, collaborator) = match (&editor, &collaborator) {
            (Some((_, editor_product)), Some((_, collaborator_product)))
                if editor_product != collaborator_product =>
            {
                log_mismatch(CATALOGUE.seats[0], "product.id");
                log_mismatch(CATALOGUE.seats[1], "product.id");
                (None, None)
            }
            _ => (
                editor.map(|(price, _)| price),
                collaborator.map(|(price, _)| price),
            ),
        };
        let verified = VerifiedPrices {
            editor,
            collaborator,
        };
        for price in [&verified.editor, &verified.collaborator]
            .into_iter()
            .flatten()
        {
            tracing::info!(
                lookup_key = price.catalogue.lookup_key,
                price_id = price.id,
                "billing price verified"
            );
        }
        verified
    }
}

fn verify_one(prices: &[Price], expected: SeatPrice) -> Option<(VerifiedPrice, String)> {
    let mut candidates = prices
        .iter()
        .filter(|price| price.lookup_key.as_deref() == Some(expected.lookup_key));
    let Some(price) = candidates.next() else {
        log_mismatch(expected, "missing");
        return None;
    };
    if candidates.next().is_some() {
        log_mismatch(expected, "lookup_key");
        return None;
    }
    let product_id = match mismatch(price, expected) {
        Ok(product_id) => product_id,
        Err(field) => {
            log_mismatch(expected, field);
            return None;
        }
    };
    Some((
        VerifiedPrice {
            id: price.id.clone(),
            catalogue: expected,
        },
        product_id.to_owned(),
    ))
}

fn mismatch(price: &Price, expected: SeatPrice) -> Result<&str, &'static str> {
    if price.lookup_key.as_deref() != Some(expected.lookup_key) {
        return Err("lookup_key");
    }
    if price
        .metadata
        .get(PRICE_SEAT_KIND_METADATA)
        .map(String::as_str)
        != Some(expected.kind.as_str())
    {
        return Err("metadata.mokly_seat_kind");
    }
    if price.unit_amount != Some(i64::from(expected.unit_amount_cents)) {
        return Err("unit_amount");
    }
    if price.currency != CATALOGUE.currency {
        return Err("currency");
    }
    let Some(recurring) = &price.recurring else {
        return Err("recurring");
    };
    if recurring.interval != CATALOGUE.interval {
        return Err("recurring.interval");
    }
    if recurring.usage_type != CATALOGUE.usage_type {
        return Err("recurring.usage_type");
    }
    let tax_behavior = match expected.tax_behavior {
        CatalogueTaxBehavior::Exclusive => TaxBehavior::Exclusive,
        CatalogueTaxBehavior::Inclusive => TaxBehavior::Inclusive,
        CatalogueTaxBehavior::Unspecified => TaxBehavior::Unspecified,
    };
    if price.tax_behavior != Some(tax_behavior) {
        return Err("tax_behavior");
    }
    if !price.active {
        return Err("active");
    }
    let ExpandableProduct::Object(product) = &price.product else {
        return Err("product.expanded");
    };
    if !product.active {
        return Err("product.active");
    }
    if product
        .metadata
        .get(PRODUCT_LOOKUP_KEY_METADATA)
        .map(String::as_str)
        != Some(CATALOGUE.product.lookup_key)
    {
        return Err("product.metadata.mokly_lookup_key");
    }
    Ok(&product.id)
}

fn log_mismatch(expected: SeatPrice, field: &'static str) {
    tracing::error!(
        lookup_key = expected.lookup_key,
        field,
        "billing price verification failed"
    );
}

#[cfg(test)]
#[path = "_tests_/prices_tests.rs"]
mod tests;
