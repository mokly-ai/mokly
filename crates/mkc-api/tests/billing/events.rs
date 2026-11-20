//! Signed event delivery and bounded observation of the billing queue.

use std::thread;
use std::time::{Duration, Instant};

use hmac::{Hmac, KeyInit, Mac};
use mkc_auth::runtime::Runtime;
use mkc_store_interface::billing_delivery::BillingDelivery;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;

use serde_json::{Value, json};
use sha2::Sha256;

use crate::contract_client::ContractResponse;

use super::harness::Harness;
use super::stripe_double::WEBHOOK_SECRET;

impl Harness {
    pub(super) fn event_body(&self, id: &str, event: &str, object: Value) -> Vec<u8> {
        self.event_body_at(id, event, self.runtime.now().timestamp(), object)
    }

    pub(super) fn event_body_at(
        &self,
        id: &str,
        event: &str,
        created: i64,
        object: Value,
    ) -> Vec<u8> {
        serde_json::to_vec(&json!({
            "id": id,
            "type": event,
            "created": created,
            "data": {"object": object}
        }))
        .unwrap()
    }

    pub(super) fn webhook(&self, body: Vec<u8>, timestamp: i64, valid: bool) -> ContractResponse {
        self.anonymous(Method::POST, "/v1/billing/webhooks")
            .header("Stripe-Signature", signature(&body, timestamp, valid))
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .unwrap()
    }

    pub(super) fn accept_event(&self, id: &str, event: &str, object: Value) -> Vec<u8> {
        let body = self.event_body(id, event, object);
        let response = self.webhook(body.clone(), self.runtime.now().timestamp(), true);
        self.body(response, 202);
        body
    }

    pub(super) fn wait_delivery(&self, id: &str, status: DeliveryStatus) -> BillingDelivery {
        self.wait_delivery_attempts(id, status, 0)
    }

    pub(super) fn wait_delivery_attempts(
        &self,
        id: &str,
        status: DeliveryStatus,
        attempts: i32,
    ) -> BillingDelivery {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let mut delivery = None;
            self.queries(&mut |queries| delivery = queries.billing_delivery(id).unwrap());
            if let Some(delivery) = delivery
                && delivery.status == status
                && delivery.attempts >= attempts
            {
                return delivery;
            }
            assert!(
                Instant::now() < deadline,
                "delivery {id} did not reach {status:?}"
            );
            thread::sleep(Duration::from_millis(25));
        }
    }

    pub(super) fn wait_delivery_terminal(&self, id: &str) -> BillingDelivery {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let mut delivery = None;
            self.queries(&mut |queries| delivery = queries.billing_delivery(id).unwrap());
            if let Some(delivery) = delivery
                && matches!(
                    delivery.status,
                    DeliveryStatus::Done | DeliveryStatus::Failed | DeliveryStatus::Ignored
                )
            {
                return delivery;
            }
            assert!(
                Instant::now() < deadline,
                "delivery {id} did not reach a terminal status"
            );
            thread::sleep(Duration::from_millis(25));
        }
    }
}

fn signature(body: &[u8], timestamp: i64, valid: bool) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(WEBHOOK_SECRET.as_bytes()).unwrap();
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);
    let bytes = if valid {
        mac.finalize().into_bytes().to_vec()
    } else {
        vec![0; 32]
    };
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("t={timestamp},v1={hex}")
}
