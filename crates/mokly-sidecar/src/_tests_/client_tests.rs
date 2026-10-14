//! Handshake, correlation and diagnostic forwarding without real processes.

use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::client::{Client, EventsMock, SidecarClient, TransportMock};
use crate::error::{Error, ProtocolError};
use crate::methods::{Call, Empty};
use crate::wire::{Event, Frame, MethodResult, Request, Response};

#[test]
fn client_requires_an_exact_version_hello_before_requests() {
    let mock = Unimock::new((
        TransportMock::send
            .next_call(
                matching!((request) if request.id == 0 && matches!(request.call, Call::Hello(_))),
            )
            .returns(Ok(())),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Response(Response::Success {
                id: 0,
                result: json!({"version":"fixture-version"}),
            }))),
        TransportMock::send
            .next_call(matching!((request) if request.id == 1))
            .returns(Ok(())),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Event(Event::Diagnostic {
                message: "consumer diagnostic".into(),
            }))),
        EventsMock::emit
            .next_call(
                matching!((Event::Diagnostic { message }) if message == "consumer diagnostic"),
            )
            .returns(()),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Response(Response::Success {
                id: 1,
                result: json!(null),
            }))),
    ));
    let mut client: Box<dyn SidecarClient> = Box::new(Client::new(
        Box::new(mock.clone()),
        Box::new(mock),
        "fixture-version".into(),
    ));
    let shutdown = Request {
        id: 1,
        call: Call::Shutdown(Empty {}),
    };
    assert!(matches!(
        client.request(&shutdown),
        Err(Error::Protocol(ProtocolError::Handshake))
    ));
    client.handshake().unwrap();
    client.handshake().unwrap();
    assert!(matches!(
        client.request(&shutdown).unwrap(),
        MethodResult::Empty
    ));
    assert!(matches!(
        client.request(&shutdown),
        Err(Error::Protocol(ProtocolError::SessionClosed))
    ));
    assert!(matches!(
        client.handshake(),
        Err(Error::Protocol(ProtocolError::SessionClosed))
    ));
}

#[test]
fn wrong_versions_and_first_events_fail_closed() {
    for (frame, version_error) in [
        (
            Frame::Response(Response::Success {
                id: 0,
                result: json!({"version":"other-version"}),
            }),
            true,
        ),
        (
            Frame::Event(Event::Diagnostic {
                message: "early".into(),
            }),
            false,
        ),
    ] {
        let mock = Unimock::new((
            TransportMock::send.next_call(matching!(_)).returns(Ok(())),
            TransportMock::receive
                .next_call(matching!())
                .returns(Ok(frame)),
        ));
        let mut client = Client::new(
            Box::new(mock.clone()),
            Box::new(mock),
            "fixture-version".into(),
        );
        match (client.handshake(), version_error) {
            (Err(Error::Version { expected, actual }), true) => {
                assert_eq!(expected, "fixture-version");
                assert_eq!(actual, "other-version");
            }
            (Err(Error::Protocol(ProtocolError::Handshake)), false) => {}
            result => panic!("unexpected handshake result: {result:?}"),
        }
        assert!(matches!(
            client.handshake(),
            Err(Error::Protocol(ProtocolError::SessionClosed))
        ));
    }
}

#[test]
fn response_id_is_checked_before_result_decoding() {
    let request = Request {
        id: 7,
        call: Call::Hello(Empty {}),
    };
    let response = Response::Success {
        id: 6,
        result: json!({"invalid":"payload"}),
    };
    assert!(matches!(
        response.decode_result(&request),
        Err(Error::Protocol(ProtocolError::ResponseId {
            expected: 7,
            actual: 6
        }))
    ));
    let response = Response::Success {
        id: 7,
        result: json!({"invalid":"payload"}),
    };
    assert!(matches!(
        response.decode_result(&request),
        Err(Error::Protocol(ProtocolError::Json { .. }))
    ));
}
