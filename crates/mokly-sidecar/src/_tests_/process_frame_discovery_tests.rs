//! A late child-start frame changes admission before a client consumes the event.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use serde_json::value::to_raw_value;
use unimock::{MockFn, Unimock, matching};

use crate::operations::Operation;
use crate::wire::{Event, Frame, Response};

use super::{FrameInputMock, forward_frames};

fn encoded(frame: Frame) -> Vec<u8> {
    let mut bytes = serde_json::to_vec(&frame).unwrap();
    bytes.push(b'\n');
    bytes
}

#[test]
fn a_child_started_after_the_response_marks_discovery_before_client_drain() {
    let response = encoded(Frame::Response(Response::Success {
        id: 1,
        result: to_raw_value(&()).unwrap(),
    }));
    let event = encoded(Frame::Event(Event::Operation {
        operation: Operation::PostcssStart,
        pid: 7,
    }));
    let (start, child) = mpsc::channel();
    let child = Mutex::new(child);
    let (queued, decoded) = mpsc::channel();
    let (finish, finished) = mpsc::channel();
    let finished = Mutex::new(finished);
    let mut reader = Unimock::new((
        FrameInputMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, output| {
                output[..response.len()].copy_from_slice(&response);
                Ok(response.len())
            })),
        FrameInputMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, output| {
                child.lock().unwrap().recv().unwrap();
                output[..event.len()].copy_from_slice(&event);
                Ok(event.len())
            })),
        FrameInputMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                queued.send(()).unwrap();
                finished.lock().unwrap().recv().unwrap();
                Ok(0)
            })),
    ));
    let discover = AtomicBool::new(false);
    let (frames, incoming) = mpsc::sync_channel(1);
    let latched = std::thread::scope(|scope| {
        let producer = scope.spawn(|| forward_frames(&mut reader, frames, &discover));
        let first = incoming.recv().unwrap().unwrap();
        assert!(matches!(
            first,
            Frame::Response(Response::Success { id: 1, .. })
        ));
        discover.store(false, Ordering::Relaxed);
        start.send(()).unwrap();
        decoded.recv().unwrap();
        let latched = discover.load(Ordering::Relaxed);
        let event = incoming.recv().unwrap().unwrap();
        finish.send(()).unwrap();
        producer.join().unwrap();
        assert!(matches!(
            event,
            Frame::Event(Event::Operation {
                operation: Operation::PostcssStart,
                pid: 7
            })
        ));
        latched
    });
    assert!(
        latched,
        "the stdout reader must mark a child before the client drains its event"
    );
}
