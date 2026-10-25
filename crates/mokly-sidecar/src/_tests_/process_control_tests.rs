//! A fake wait exposes the shutdown boundary without sleeping or spawning.

use std::sync::{Arc, Mutex, mpsc};

use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::process_clock::WaitMock;
use crate::process_control::ProcessControl;
use crate::workers::WorkerControl;

#[test]
fn a_process_that_survives_the_shared_deadline_is_killed_and_reaped() {
    let mock = Unimock::new((
        WaitMock::exited
            .next_call(matching!(_, 2_100))
            .returns(false),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
        WaitMock::reaped.next_call(matching!(_)).returns(()),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let (sender, receiver) = mpsc::sync_channel(2);
    let (_exited_sender, exited) = mpsc::sync_channel(1);
    let (_drained_sender, drained) = mpsc::sync_channel(1);
    let control: Box<dyn WorkerControl> = Box::new(ProcessControl {
        startup: Default::default(),
        group: Box::new(mock.clone()),
        outgoing: sender,
        exited: Mutex::new(exited),
        drained: Mutex::new(drained),
        clock: Arc::new(mock.clone()),
    });
    control.shutdown().unwrap();
    let encoded = receiver.recv().unwrap();
    let frame: serde_json::Value = serde_json::from_slice(&encoded).unwrap();
    assert_eq!(frame["method"], "shutdown");
    assert!(frame["id"].as_u64().unwrap() <= 9_007_199_254_740_991);
    control.finish(2_100).unwrap();
}

#[test]
fn an_open_stderr_pipe_cannot_extend_the_shared_deadline() {
    let mock = Unimock::new((
        WaitMock::exited
            .next_call(matching!(_, 2_100))
            .answers(&|_, receiver, _| {
                assert!(matches!(
                    receiver.try_recv(),
                    Err(mpsc::TryRecvError::Disconnected)
                ));
                true
            }),
        WaitMock::drained
            .next_call(matching!(_, 2_100))
            .answers(&|_, receiver, _| {
                assert!(matches!(
                    receiver.try_recv(),
                    Err(mpsc::TryRecvError::Empty)
                ));
                false
            }),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let (outgoing, _frames) = mpsc::sync_channel(2);
    let exited = {
        let (_exited_sender, exited) = mpsc::sync_channel(1);
        exited
    };
    let (_never_drained, drained) = mpsc::sync_channel(1);
    let control: Box<dyn WorkerControl> = Box::new(ProcessControl {
        startup: Default::default(),
        group: Box::new(mock.clone()),
        outgoing,
        exited: Mutex::new(exited),
        drained: Mutex::new(drained),
        clock: Arc::new(mock),
    });
    control.finish(2_100).unwrap();
}

#[test]
fn graceful_completion_waits_for_exit_and_drain_with_one_deadline() {
    let mock = Unimock::new((
        WaitMock::exited
            .next_call(matching!(_, 2_100))
            .returns(true),
        WaitMock::drained
            .next_call(matching!(_, 2_100))
            .returns(true),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let (outgoing, _frames) = mpsc::sync_channel(2);
    let (_exited_sender, exited) = mpsc::sync_channel(1);
    let (_drained_sender, drained) = mpsc::sync_channel(1);
    let control: Box<dyn WorkerControl> = Box::new(ProcessControl {
        startup: Default::default(),
        group: Box::new(mock.clone()),
        outgoing,
        exited: Mutex::new(exited),
        drained: Mutex::new(drained),
        clock: Arc::new(mock),
    });
    control.finish(2_100).unwrap();
}
