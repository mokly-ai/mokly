//! Exact provider request reconstructed from durable Checkout state.

use std::collections::BTreeMap;

use mkc_billing_interface::provider::{CreateCheckout, LineItem};
use mkc_store_interface::billing_checkout::BillingCheckoutSession;

use crate::billing::error::{Error, Result};

pub(super) fn provider_request(request: &BillingCheckoutSession) -> Result<CreateCheckout> {
    let mut line_items = vec![LineItem {
        price: request.editor_price_id.clone(),
        quantity: i64::from(request.editor_quantity),
    }];
    if request.collaborator_quantity > 0 {
        line_items.push(LineItem {
            price: request.collaborator_price_id.clone(),
            quantity: i64::from(request.collaborator_quantity),
        });
    }
    let metadata = BTreeMap::from([
        (
            "organization_id".to_owned(),
            request.organization_id.to_string(),
        ),
        ("checkout_session_id".to_owned(), request.id.to_string()),
    ]);
    Ok(CreateCheckout {
        customer: request.provider_customer_id.clone(),
        client_reference_id: request.organization_id.to_string(),
        success_url: request.success_url.clone(),
        cancel_url: request.cancel_url.clone(),
        line_items,
        trial_period_days: request
            .trial_period_days
            .map(u32::try_from)
            .transpose()
            .map_err(Error::internal)?,
        automatic_tax: true,
        collect_billing_address: true,
        save_customer_address: true,
        expires_at: Some(request.expires_at.timestamp()),
        metadata,
        idempotency_key: request.idempotency_key.clone(),
    })
}

#[cfg(test)]
#[path = "_tests_/checkout_input_tests.rs"]
mod tests;
