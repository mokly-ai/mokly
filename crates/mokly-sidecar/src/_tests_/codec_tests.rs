//! Framing, UTF-8 and JSON decoding.

use serde_json::json;

use crate::codec::{Decoder, MAX_FRAME_BYTES, encode};
use crate::error::{Error, ProtocolError};
use crate::methods::{Call, Generation, Hello};
use crate::wire::{Frame, Request, Response};

#[test]
fn split_utf8_and_multiple_frames_decode_in_order() {
    let bytes = b"{\"result\":null,\"id\":1}\n{\"params\":{\"message\":\"\xf0\x9f\x98\x80\"},\"event\":\"diagnostic\"}\n";
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
fn invalid_json_bad_utf8_and_partial_frames_fail() {
    for bytes in [
        &b"\n"[..],
        &b"{}\n"[..],
        &b"\xff\n"[..],
        &b"{\"id\":1}\n"[..],
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
}

#[test]
fn duplicate_fields_only_invalidate_candidates_that_use_them() {
    for (input, expected) in [
        (
            r#"{"params":0,"event":false,"error":0,"id":1,"result":null,"error":false,"event":true,"params":1}"#,
            json!({"id":1,"result":null}),
        ),
        (
            r#"{"id":2,"result":null,"error":{"code":"bundle-failed","message":"fallback"},"result":false}"#,
            json!({"id":2,"error":{"code":"bundle-failed","message":"fallback"}}),
        ),
    ] {
        let response = serde_json::from_str::<Response>(input);
        assert!(response.is_ok(), "response rejected {input}: {response:?}");
        assert_eq!(serde_json::to_value(response.unwrap()).unwrap(), expected);
        let bytes = format!("{input}\n");
        let frames = Decoder::default().push(bytes.as_bytes());
        assert!(frames.is_ok(), "frame rejected {input}: {frames:?}");
        let frames = frames.unwrap();
        assert_eq!(frames.len(), 1, "{input}");
        assert_eq!(
            serde_json::to_value(&frames[0]).unwrap(),
            expected,
            "{input}"
        );
    }
    for input in [
        r#"{"id":1,"result":null,"id":2,"event":"diagnostic","params":{"message":"event"}}"#,
        r#"{"id":3,"result":null,"result":false,"error":0,"error":1,"event":"diagnostic","params":{"message":"event"}}"#,
    ] {
        let response = serde_json::from_str::<Response>(input);
        assert!(response.is_err(), "response accepted {input}: {response:?}");
        assert_eq!(
            response.unwrap_err().classify(),
            serde_json::error::Category::Data,
            "{input}"
        );
        let bytes = format!("{input}\n");
        let frames = Decoder::default().push(bytes.as_bytes());
        assert!(
            frames.is_ok(),
            "event fallback rejected {input}: {frames:?}"
        );
        let frames = frames.unwrap();
        assert_eq!(frames.len(), 1, "{input}");
        assert_eq!(
            serde_json::to_value(&frames[0]).unwrap(),
            json!({"event":"diagnostic","params":{"message":"event"}}),
            "{input}"
        );
    }
    for input in [
        r#"{"event":"diagnostic","event":"diagnostic","params":{"message":"event"}}"#,
        r#"{"event":"diagnostic","params":{"message":"first"},"params":{"message":"last"}}"#,
    ] {
        let bytes = format!("{input}\n");
        let frames = Decoder::default().push(bytes.as_bytes());
        assert!(
            matches!(&frames, Err(Error::Protocol(ProtocolError::Json { .. }))),
            "accepted duplicate event fields {input}: {frames:?}"
        );
    }
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
    let request = Request {
        id: 1,
        call: Call::Describe(Generation {
            generation: "x".repeat(MAX_FRAME_BYTES - envelope.len() + 1),
        }),
    };
    assert!(matches!(
        encode(&request),
        Err(Error::Protocol(ProtocolError::Oversized {
            limit: MAX_FRAME_BYTES
        }))
    ));
}

#[test]
fn hello_encoding_and_method_deadlines_match_the_contract() {
    let request = Request {
        id: 0,
        call: Call::Hello(Hello::default()),
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
        json!({"method":"processCss","params":{"context":"css","sourceRoot":"/repo","moduleResolution":{},"repositoryRoots":[],"postcss":"p.cjs","sourcePath":"a.css","text":""}}),
    )
    .unwrap();
    assert_eq!(call.timeout_ms(), 60_000);
}
