//! Verify original webhook bytes before decoding and durable acceptance.

use mkc_billing_interface::webhooks::Verification;
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::Callback;
use serde::Deserialize;

use crate::billing::error::{Error, ErrorResultExt, Result};

use super::service::DatabaseBillingService;

#[derive(Deserialize)]
struct Envelope {
    id: String,
    #[serde(rename = "type")]
    type_: String,
    created: i64,
}

impl DatabaseBillingService {
    pub(super) fn accept_webhook(&self, signature: &str, body: &[u8]) -> Result<()> {
        let verification = self
            .verifier
            .verify(signature, body, self.runtime.now())
            .map_or_else(|error| Err(Error::from_provider(error)), Ok)?;
        if verification != Verification::Valid {
            return Err(Error::WebhookSignatureInvalid);
        }
        let envelope: Envelope = match serde_json::from_slice(body) {
            Ok(envelope) => envelope,
            Err(_) => return Err(Error::ValidationFailed),
        };
        if !valid_event_id(&envelope.id)
            || !valid_event_name(&envelope.type_)
            || envelope.created < 0
        {
            return Err(Error::ValidationFailed);
        }
        let now = self.runtime.now();
        let delivery = BillingDelivery {
            id: envelope.id,
            event: envelope.type_,
            body: body.to_vec(),
            received_at: now,
            due_at: now,
            attempts: 0,
            status: DeliveryStatus::Pending,
            lease: None,
            lease_until: None,
            last_failure: None,
        };
        let mut mismatch = false;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                mismatch = false;
                if let Some(existing) = queries.billing_delivery(&delivery.id)? {
                    mismatch = existing.body != delivery.body;
                    return Ok(());
                }
                queries.save_billing_delivery(&delivery)
            }))
            .context("persist signed billing webhook")?;
        if mismatch {
            Err(Error::ValidationFailed)
        } else {
            Ok(())
        }
    }
}

fn valid_event_id(value: &str) -> bool {
    value.strip_prefix("evt_").is_some_and(|suffix| {
        !suffix.is_empty()
            && suffix.len() <= 64
            && suffix.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}

fn valid_event_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || matches!(byte, b'_' | b'.'))
}
