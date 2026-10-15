//! A valid error reply preserves the session unless the protocol failed.

use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::client::{Client, SidecarClient, TransportMock};
use crate::diagnostics::DefinitionCode;
use crate::error::{Error, ProtocolError, RemoteCode, RequestCode};
use crate::methods::{Call, Empty, Generation};
use crate::wire::{Frame, MethodResult, RemoteError, Request, Response};

#[test]
fn bundle_render_and_definition_errors_allow_another_request() {
    for code in [
        RemoteCode::Request(RequestCode::BundleFailed),
        RemoteCode::Request(RequestCode::RenderFailed),
        RemoteCode::Definition(DefinitionCode::ArrayExport),
    ] {
        let mock = Unimock::new((
            TransportMock::send
                .next_call(matching!((request) if request.id == 0))
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
                .returns(Ok(Frame::Response(Response::Failure {
                    id: 1,
                    error: RemoteError {
                        postcss: None,
                        code,
                        message: "source diagnostic".into(),
                    },
                }))),
            TransportMock::send
                .next_call(matching!((request) if request.id == 2))
                .returns(Ok(())),
            TransportMock::receive
                .next_call(matching!())
                .returns(Ok(Frame::Response(Response::Success {
                    id: 2,
                    result: json!(null),
                }))),
        ));
        let mut client = Client::new(
            Box::new(mock.clone()),
            Box::new(mock),
            "fixture-version".into(),
        );
        client.handshake().unwrap();
        assert!(matches!(
            client.request(&Request {
                id: 1,
                call: Call::Describe(Generation {
                    generation: "g".into()
                })
            }),
            Err(Error::Remote { .. })
        ));
        assert!(matches!(
            client
                .request(&Request {
                    id: 2,
                    call: Call::Shutdown(Empty {})
                })
                .unwrap(),
            MethodResult::Empty
        ));
    }
}

#[test]
fn a_remote_protocol_failure_closes_the_session() {
    let mock = Unimock::new((
        TransportMock::send.next_call(matching!(_)).returns(Ok(())),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Response(Response::Success {
                id: 0,
                result: json!({"version":"fixture-version"}),
            }))),
        TransportMock::send.next_call(matching!(_)).returns(Ok(())),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Response(Response::Failure {
                id: 1,
                error: RemoteError {
                    postcss: None,
                    code: RemoteCode::Request(RequestCode::SidecarProtocol),
                    message: "invalid request".into(),
                },
            }))),
    ));
    let mut client = Client::new(
        Box::new(mock.clone()),
        Box::new(mock),
        "fixture-version".into(),
    );
    client.handshake().unwrap();
    let request = Request {
        id: 1,
        call: Call::Shutdown(Empty {}),
    };
    assert!(matches!(
        client.request(&request),
        Err(Error::Remote {
            code: RemoteCode::Request(RequestCode::SidecarProtocol),
            ..
        })
    ));
    assert!(matches!(
        client.request(&request),
        Err(Error::Protocol(ProtocolError::SessionClosed))
    ));
}
