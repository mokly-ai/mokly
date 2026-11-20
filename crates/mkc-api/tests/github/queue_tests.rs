//! Raw-byte authenticity, redelivery, transient failure and crash recovery.

use std::thread;
use std::time::{self, Instant};

use chrono::{Duration, Utc};
use mkc_store_interface::github_delivery::Delivery;
use mkc_store_interface::github_state::{DeliveryStatus, Failure};
use uuid::Uuid;

use super::fixtures;
use super::harness::{Harness, json};

#[test]
fn webhook_authentication_idempotency_and_handler_failures_are_durable() {
    let Some(app) = Harness::start() else {
        return;
    };
    let id = Uuid::now_v7();
    let body = b"{  \"zen\": \"keep these bytes\" }\n".to_vec();
    let invalid = json(app.webhook(id, "ping", body.clone(), false), 401);
    assert_eq!(invalid["error"]["reason"], "webhook-signature-invalid");
    assert!(app.delivery(id).is_none());
    let accepted = app.webhook(id, "ping", body.clone(), true);
    assert_eq!(accepted.status(), 202);
    assert!(accepted.bytes().is_empty());
    let original = app.wait_delivery(id, DeliveryStatus::Ignored);
    assert_eq!(original.body, body);
    assert_eq!(app.webhook(id, "ping", body.clone(), true).status(), 202);
    let duplicate = app.delivery(id).unwrap();
    assert_eq!(original.received_at, duplicate.received_at);
    assert_eq!(original.attempts, duplicate.attempts);
    assert_eq!(app.webhook(id, "ping", b"{}".to_vec(), true).status(), 400);
    let malformed = Uuid::now_v7();
    assert_eq!(
        app.webhook(malformed, "push", b"{".to_vec(), true).status(),
        202
    );
    let failed = app.wait_delivery(malformed, DeliveryStatus::Failed);
    assert_eq!(failed.last_failure, Some(Failure::Malformed));
    assert_eq!(failed.attempts, 1);
    app.send("unknown_future_event", "ping", DeliveryStatus::Ignored);
}

#[test]
fn retry_schedule_and_expired_leases_recover_without_losing_deliveries() {
    let Some(app) = Harness::start() else {
        return;
    };
    app.send("installation", "installation", DeliveryStatus::Done);
    app.github.mode.lock().unwrap().fail_next_branch = true;
    let id = Uuid::now_v7();
    assert_eq!(
        app.webhook(id, "push", fixtures::delivery("push"), true)
            .status(),
        202
    );
    let deadline = Instant::now() + time::Duration::from_secs(10);
    loop {
        let delivery = app.delivery(id).unwrap();
        if delivery.status == DeliveryStatus::Pending && delivery.attempts == 1 {
            assert_eq!(delivery.last_failure, Some(Failure::Unavailable));
            assert!(delivery.due_at >= delivery.received_at + Duration::seconds(5));
            app.queries(&mut |queries| {
                let mut current = queries.github_delivery(id).unwrap().unwrap();
                current.due_at = Utc::now() - Duration::seconds(1);
                queries.save_github_delivery(&current).unwrap();
            });
            break;
        }
        assert!(
            Instant::now() < deadline,
            "retry not observed: {delivery:?}"
        );
        thread::sleep(time::Duration::from_millis(25));
    }
    assert_eq!(app.wait_delivery(id, DeliveryStatus::Done).attempts, 2);
    for (attempts, expected) in [(1, DeliveryStatus::Ignored), (8, DeliveryStatus::Failed)] {
        let id = Uuid::now_v7();
        let now = Utc::now();
        app.queries(&mut |queries| {
            queries
                .save_github_delivery(&Delivery {
                    id,
                    event: "ping".into(),
                    body: fixtures::delivery("ping"),
                    received_at: now,
                    due_at: now,
                    attempts,
                    status: DeliveryStatus::Processing,
                    lease: Some(Uuid::now_v7()),
                    lease_until: Some(now - Duration::seconds(1)),
                    last_failure: None,
                })
                .unwrap()
        });
        let delivery = app.wait_delivery(id, expected);
        assert!(delivery.lease.is_none());
        if attempts == 8 {
            assert_eq!(
                app.webhook(id, "ping", fixtures::delivery("ping"), true)
                    .status(),
                202
            );
            assert_eq!(app.wait_delivery(id, DeliveryStatus::Ignored).attempts, 1);
        }
    }
}
