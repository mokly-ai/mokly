//! JSON forms shared by hubs and relay adapters.

#![allow(clippy::unwrap_used)]

use mkc_domain::ids::ProjectId;
use serde_json::{from_value, json, to_value};
use uuid::Uuid;

use crate::messages::{ClientEvent, Notice};

use super::{ProjectNotice, RelayMessage, ReplicaId};

#[test]
fn a_project_notice_decodes_the_flat_trigger_payload() {
    let wire = json!({
        "project": "00000000-0000-0000-0000-000000000001",
        "kind": "build-log",
        "id": "00000000-0000-0000-0000-000000000002",
        "sequence": 23
    });
    assert_eq!(
        from_value::<ProjectNotice>(wire).ok(),
        Some(ProjectNotice {
            project: ProjectId(Uuid::from_u128(1)),
            notice: Notice {
                kind: "build-log".into(),
                id: Uuid::from_u128(2),
                sequence: 23,
            },
        })
    );
}

#[test]
fn a_relay_message_carries_the_replica_project_and_events() {
    let event: ClientEvent = from_value(json!({"type": "test-event", "value": 19})).unwrap();
    let message = RelayMessage {
        replica: ReplicaId(Uuid::from_u128(1)),
        project: ProjectId(Uuid::from_u128(2)),
        events: vec![event],
    };
    let wire = json!({
        "replica": "00000000-0000-0000-0000-000000000001",
        "project": "00000000-0000-0000-0000-000000000002",
        "events": [{"type": "test-event", "value": 19}]
    });
    assert_eq!(to_value(&message).unwrap(), wire);
    assert_eq!(from_value::<RelayMessage>(wire).unwrap(), message);
}
