//! Relay message packing and JSON notification decoding.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeMap;

use mkc_domain::ids::ProjectId;
use mkc_live_interface::messages::{ClientEvent, Notice};
use mkc_live_interface::relay::{InboundEvent, ProjectNotice, RelayMessage, ReplicaId, TickBatch};
use serde_json::json;
use uuid::Uuid;

use super::{decode, encode};

const REPLICA: ReplicaId = ReplicaId(Uuid::from_u128(1));
const PROJECT: ProjectId = ProjectId(Uuid::from_u128(2));
const OTHER: ProjectId = ProjectId(Uuid::from_u128(3));

#[test]
fn a_tick_splits_by_project_and_byte_length_in_receive_order() {
    let first = event("é".repeat(1_990));
    let second = event("b".repeat(3_990));
    let third = event("final".into());
    let other = event("other project".into());
    let batch = TickBatch {
        replica: REPLICA,
        projects: BTreeMap::from([
            (PROJECT, vec![first.clone(), second.clone(), third.clone()]),
            (OTHER, vec![other.clone()]),
        ]),
    };

    let encoded = encode(batch).unwrap();
    assert_eq!(encoded.largest_dropped_event, None);
    let payloads = encoded.payloads;
    assert_eq!(payloads.len(), 3);
    assert!(payloads.iter().all(|payload| payload.len() < 7_900));
    let messages = payloads
        .iter()
        .map(|payload| serde_json::from_str::<RelayMessage>(payload).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        messages,
        vec![
            RelayMessage {
                replica: REPLICA,
                project: PROJECT,
                events: vec![first],
            },
            RelayMessage {
                replica: REPLICA,
                project: PROJECT,
                events: vec![second, third],
            },
            RelayMessage {
                replica: REPLICA,
                project: OTHER,
                events: vec![other],
            },
        ]
    );
}

#[test]
fn channel_payloads_decode_into_the_relay_contract() {
    let notice = r#"{
        "project":"00000000-0000-0000-0000-000000000002",
        "kind":"build",
        "id":"00000000-0000-0000-0000-000000000004",
        "sequence":14
    }"#;
    assert_eq!(
        decode("mkc_live_notice", notice).unwrap(),
        Some(InboundEvent::Notice(ProjectNotice {
            project: PROJECT,
            notice: Notice {
                kind: "build".into(),
                id: Uuid::from_u128(4),
                sequence: 14,
            },
        }))
    );
    let relay = r#"{
        "replica":"00000000-0000-0000-0000-000000000001",
        "project":"00000000-0000-0000-0000-000000000003",
        "events":[{"type":"test-event","value":"hello"}]
    }"#;
    assert_eq!(
        decode("mkc_live_relay", relay).unwrap(),
        Some(InboundEvent::Relay(RelayMessage {
            replica: REPLICA,
            project: OTHER,
            events: vec![event("hello".into())],
        }))
    );
}

#[test]
fn oversized_events_leave_other_events_in_receive_order() {
    let first = event("first".into());
    let last = event("last".into());
    let other = event("other project".into());
    let oversized = event("a".repeat(7_900));
    // A relay envelope and a two-byte chunk suffix bring this to 7,900 bytes.
    let at_limit = event("b".repeat(7_755));
    let batch = TickBatch {
        replica: REPLICA,
        projects: BTreeMap::from([
            (PROJECT, vec![first.clone(), oversized, last.clone()]),
            (OTHER, vec![other.clone(), at_limit]),
        ]),
    };

    let encoded = encode(batch).unwrap();
    assert_eq!(encoded.largest_dropped_event, Some((PROJECT, 7_932)));
    let payloads = encoded.payloads;
    assert!(payloads.iter().all(|payload| payload.len() < 7_900));
    let messages = payloads
        .iter()
        .map(|payload| serde_json::from_str::<RelayMessage>(payload).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(
        messages,
        vec![
            RelayMessage {
                replica: REPLICA,
                project: PROJECT,
                events: vec![first, last],
            },
            RelayMessage {
                replica: REPLICA,
                project: OTHER,
                events: vec![other],
            },
        ]
    );
}

fn event(value: String) -> ClientEvent {
    serde_json::from_value(json!({"type": "test-event", "value": value})).unwrap()
}
