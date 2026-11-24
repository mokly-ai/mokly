//! The JSON boundary of the live channel.

#![allow(clippy::unwrap_used)]

use serde_json::{error::Category, from_value, json, to_value};
#[cfg(feature = "openapi")]
use utoipa::OpenApi;
use uuid::Uuid;

use super::{ClientEvent, Notice, ServerMessage, ServerSignal};

#[test]
fn server_signals_have_flat_tagged_objects() {
    let notice = ServerMessage::Signal(ServerSignal::Notice(Notice {
        kind: "build-log".into(),
        id: Uuid::from_u128(1),
        sequence: 29,
    }));
    let wire = json!({
        "type": "notice",
        "kind": "build-log",
        "id": "00000000-0000-0000-0000-000000000001",
        "sequence": 29
    });
    assert_eq!(to_value(&notice).unwrap(), wire);
    assert_eq!(from_value::<ServerMessage>(wire).unwrap(), notice);

    let resync = ServerMessage::Signal(ServerSignal::Resync);
    assert_eq!(to_value(&resync).unwrap(), json!({"type": "resync"}));
    assert_eq!(
        from_value::<ServerMessage>(json!({"type": "resync"})).unwrap(),
        resync
    );
}

#[test]
fn a_client_event_retains_the_kind_and_fields_at_the_top_level() {
    let wire = json!({"type": "test-event", "fields": {"value": 17}, "more": [false, null]});
    let event: ClientEvent = from_value(wire.clone()).unwrap();
    assert_eq!(event.kind(), "test-event");
    assert_eq!(to_value(ServerMessage::ClientEvent(event)).unwrap(), wire);
}

#[test]
fn a_client_event_cannot_use_a_server_signal_type() {
    for kind in ["notice", "resync"] {
        let error = from_value::<ClientEvent>(json!({"type": kind})).unwrap_err();
        assert_eq!(error.classify(), Category::Data, "{kind}");
    }
}

#[cfg(feature = "openapi")]
#[test]
fn the_socket_types_generate_openapi_components() {
    #[derive(OpenApi)]
    #[openapi(components(schemas(ServerMessage)))]
    struct Contract;

    let document = to_value(Contract::openapi()).unwrap();
    let schemas = &document["components"]["schemas"];
    let variants = schemas["ServerMessage"]["oneOf"].as_array().unwrap();
    assert_eq!(variants.len(), 2);
    assert_eq!(variants[0]["$ref"], "#/components/schemas/ServerSignal");
    assert_eq!(variants[1]["$ref"], "#/components/schemas/ClientEvent");
    let signals = &schemas["ServerSignal"]["oneOf"];
    assert_eq!(
        signals[0]["allOf"][1]["properties"]["type"]["enum"],
        json!(["notice"])
    );
    assert_eq!(signals[1]["properties"]["type"]["enum"], json!(["resync"]));
    assert_eq!(schemas["ClientEvent"]["required"], json!(["type"]));
    assert_eq!(
        schemas["ClientEvent"]["properties"]["type"]["type"],
        "string"
    );
    assert_eq!(schemas["Notice"]["properties"]["id"]["format"], "uuid");
    assert_eq!(
        schemas["Notice"]["properties"]["sequence"]["type"],
        "integer"
    );
}
