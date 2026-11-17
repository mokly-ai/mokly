//! Authenticate original bytes and commit durable webhook acceptance.

use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_state::DeliveryStatus;
use uuid::Uuid;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::input::IncomingDelivery;
use super::service::GitHubService;

impl GitHubService {
    pub(super) fn accept_delivery(&self, input: IncomingDelivery) -> Result<()> {
        if input.body.len() > 2 * 1024 * 1024 {
            return Err(ApiError::PayloadTooLarge);
        }
        if !self.verifier.verify(&input.signature, &input.body)? {
            return Err(ApiError::WEBHOOK_SIGNATURE_INVALID);
        }
        let id = match Uuid::parse_str(&input.id) {
            Ok(id) => id,
            Err(_) => return Err(ApiError::ValidationFailed),
        };
        if input.event.is_empty()
            || input.event.len() > 64
            || !input
                .event
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
        {
            return Err(ApiError::ValidationFailed);
        }
        let now = self.runtime.now();
        self.transact(false, &mut |queries| {
            let delivery = match queries
                .github_delivery(id)
                .context("read webhook delivery idempotency")?
            {
                Some(mut existing) => {
                    if existing.event != input.event || existing.body != input.body {
                        return Err(ApiError::ValidationFailed);
                    }
                    if existing.status != DeliveryStatus::Failed {
                        return Ok(());
                    }
                    existing.status = DeliveryStatus::Pending;
                    existing.attempts = 0;
                    existing.due_at = now;
                    existing.last_failure = None;
                    existing
                }
                None => Delivery {
                    id,
                    event: input.event.clone(),
                    body: input.body.clone(),
                    received_at: now,
                    due_at: now,
                    attempts: 0,
                    status: DeliveryStatus::Pending,
                    lease: None,
                    lease_until: None,
                    last_failure: None,
                },
            };
            queries
                .save_github_delivery(&delivery)
                .context("persist signed webhook delivery")?;
            Ok(())
        })
    }
}
