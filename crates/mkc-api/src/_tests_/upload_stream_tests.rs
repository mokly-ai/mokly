//! A broken HTTP stream must never be mistaken for a completed upload.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::io::{Cursor, Read};

use bytes::Bytes;
use tokio::sync::mpsc;

use crate::upload_stream::{BodyChunk, ChannelReader};

#[test]
fn sender_disconnect_is_an_error_even_after_valid_gzip_bytes() {
    let receiver = {
        let (sender, receiver) = mpsc::channel(2);
        sender
            .blocking_send(BodyChunk::Data(Bytes::from_static(b"complete archive")))
            .unwrap();
        receiver
    };
    let mut reader = ChannelReader {
        receiver,
        current: Cursor::new(Bytes::new()),
        complete: false,
    };
    let mut output = [0; 16];
    assert_eq!(reader.read(&mut output).unwrap(), 16);
    assert!(reader.read(&mut output).is_err());
}

#[test]
fn explicit_completion_exposes_eof_after_all_bytes() {
    let receiver = {
        let (sender, receiver) = mpsc::channel(2);
        sender
            .blocking_send(BodyChunk::Data(Bytes::from_static(b"archive")))
            .unwrap();
        sender.blocking_send(BodyChunk::Complete).unwrap();
        receiver
    };
    let mut reader = ChannelReader {
        receiver,
        current: Cursor::new(Bytes::new()),
        complete: false,
    };
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes).unwrap();
    assert_eq!(bytes, b"archive");
    assert_eq!(reader.read(&mut [0]).unwrap(), 0);
}
