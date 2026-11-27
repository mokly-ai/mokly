//! Signed HTTP deliveries and bounded observations of the durable worker queue.

use std::thread;
use std::time::{Duration, Instant};

use hmac::{Hmac, KeyInit, Mac};
use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_state::DeliveryStatus;
use reqwest::Method;

use sha2::Sha256;
use uuid::Uuid;

use crate::contract_client::ContractResponse;

use super::fixtures;
use super::harness::{Harness, SECRET};

impl Harness {
    pub(super) fn webhook(
        &self,
        id: Uuid,
        event: &str,
        body: Vec<u8>,
        valid: bool,
    ) -> ContractResponse {
        let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).unwrap();
        mac.update(&body);
        let hex: String = mac
            .finalize()
            .into_bytes()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let signature = if valid {
            format!("sha256={hex}")
        } else {
            format!("sha256={}", "0".repeat(64))
        };
        self.request(Method::POST, "/v1/github/webhooks")
            .header("X-GitHub-Delivery", id.to_string())
            .header("X-GitHub-Event", event)
            .header("X-Hub-Signature-256", signature)
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .unwrap()
    }

    pub(super) fn send(&self, event: &str, fixture: &str, status: DeliveryStatus) -> Uuid {
        let id = Uuid::now_v7();
        let response = self.webhook(id, event, fixtures::delivery(fixture), true);
        assert_eq!(response.status(), 202, "{}", response.text().unwrap());
        self.wait_delivery(id, status);
        id
    }

    pub(super) fn delivery(&self, id: Uuid) -> Option<Delivery> {
        let mut found = None;
        self.queries(&mut |queries| {
            found = queries.github_delivery(id)?;
            Ok(())
        });
        found
    }

    pub(super) fn wait_delivery(&self, id: Uuid, status: DeliveryStatus) -> Delivery {
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            let delivery = self.delivery(id).unwrap();
            if delivery.status == status {
                return delivery;
            }
            assert!(
                Instant::now() < deadline,
                "delivery {id}: {delivery:?}; expected {status:?}"
            );
            thread::sleep(Duration::from_millis(25));
        }
    }
}
