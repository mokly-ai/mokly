//! Framing, UTF-8 and fail-closed envelope checks.

use serde_json::json;

use crate::codec::{Decoder, MAX_FRAME_BYTES, encode};
use crate::error::{Error, ProtocolError};
use crate::methods::{Call, Empty};
use crate::wire::{Frame, Request, Response};

#[test]
fn split_utf8_and_multiple_frames_decode_in_order() {
    let bytes = b"{\"id\":1,\"result\":null}\n{\"event\":\"diagnostic\",\"params\":{\"message\":\"\xf0\x9f\x98\x80\"}}\n";
    let mut decoder = Decoder::default();
    let mut frames = Vec::new();
    for byte in bytes {
        frames.extend(decoder.push(&[*byte]).unwrap());
    }
    assert_eq!(frames.len(), 2);
    assert!(matches!(
        frames[0],
        Frame::Response(Response::Success { id: 1, .. })
    ));
    assert!(matches!(frames[1], Frame::Event(_)));
    decoder.finish().unwrap();
    let mut decoder = Decoder::default();
    assert_eq!(decoder.push(bytes).unwrap().len(), 2);
}

#[test]
fn malformed_envelopes_unknown_methods_and_bad_utf8_fail() {
    for bytes in [
        &b"\n"[..],
        &b"{}\n"[..],
        &b"\xff\n"[..],
        &b"{\"id\":1}\n"[..],
        &b"{\"id\":1,\"result\":null,\"error\":{\"code\":\"render-failed\",\"message\":\"x\"}}\n"[..],
        &b"{\"id\":1,\"event\":\"diagnostic\",\"params\":{\"message\":\"x\"}}\n"[..],
        &b"{\"id\":1,\"method\":\"unknown\",\"params\":{}}\n"[..],
        &b"{\"event\":\"unknown\",\"params\":{}}\n"[..],
    ] {
        assert!(
            Decoder::default().push(bytes).is_err(),
            "accepted {bytes:?}"
        );
    }
    let mut decoder = Decoder::default();
    decoder.push(b"{\"id\":1").unwrap();
    assert!(matches!(
        decoder.finish(),
        Err(Error::Protocol(ProtocolError::Truncated))
    ));
    assert!(
        serde_json::from_value::<Request>(json!({"id":1,"method":"unknown","params":{}})).is_err()
    );
}

#[test]
fn exact_frame_limit_is_accepted_and_excess_is_rejected_before_buffering() {
    let envelope = b"{\"id\":1,\"result\":\"\"}";
    let mut bytes = b"{\"id\":1,\"result\":\"".to_vec();
    bytes.resize(MAX_FRAME_BYTES - 2, b'x');
    bytes.extend_from_slice(b"\"}\n");
    assert_eq!(bytes.len(), MAX_FRAME_BYTES + 1);
    assert_eq!(Decoder::default().push(&bytes).unwrap().len(), 1);
    bytes.insert(bytes.len() - 3, b'x');
    assert!(matches!(
        Decoder::default().push(&bytes),
        Err(Error::Protocol(ProtocolError::Oversized { .. }))
    ));
    let value = "x".repeat(MAX_FRAME_BYTES - envelope.len() + 1);
    assert!(encode(&json!({"id":1,"result":value})).is_err());
}

#[test]
fn hello_encoding_and_method_deadlines_match_the_contract() {
    let request = Request {
        id: 0,
        call: Call::Hello(Empty {}),
    };
    assert_eq!(
        String::from_utf8(encode(&request).unwrap()).unwrap(),
        "{\"id\":0,\"method\":\"hello\",\"params\":{}}\n"
    );
    assert_eq!(request.call.timeout_ms(), 30_000);
    let call =
        serde_json::from_value::<Call>(json!({"method":"describe","params":{"generation":"g"}}))
            .unwrap();
    assert_eq!(call.timeout_ms(), 120_000);
    let call = serde_json::from_value::<Call>(
        json!({"method":"processCss","params":{"postcss":"p.cjs","sourcePath":"a.css","text":""}}),
    )
    .unwrap();
    assert_eq!(call.timeout_ms(), 60_000);
}
