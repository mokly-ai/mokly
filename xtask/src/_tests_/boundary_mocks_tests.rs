//! Downstream compilation and use of every public impure boundary mock.

use std::path::Path;
use std::process::Command;

use mokly_git::batches::{Batches, BatchesMock};
use mokly_git::command::{self, Output, Runner, RunnerMock};
use mokly_platform::locks::{FileLock, Locks, LocksMock};
use mokly_platform::processes::{ProcessGroup, ProcessGroupMock, ProcessGroups, ProcessGroupsMock};
use mokly_platform::rename::{Rename, RenameMock};
use mokly_sidecar::client::{
    ClientMock, Events, EventsMock, SidecarClient, Transport, TransportMock,
};
use mokly_sidecar::methods::{Call, Empty};
use mokly_sidecar::wire::{self, Event, Frame, MethodResult, Response};
use unimock::{MockFn, Unimock, matching};

#[test]
fn platform_mocks_are_usable_from_a_downstream_crate() {
    let held: Box<dyn FileLock> = Box::new(Unimock::new(()));
    let locks: &dyn Locks = &Unimock::new(
        LocksMock::try_lock
            .next_call(matching!(_))
            .returns(Ok(held)),
    );
    let _guard = locks.try_lock(Path::new("fixture.lock")).unwrap();
    let rename: &dyn Rename = &Unimock::new(
        RenameMock::exclusive
            .next_call(matching!(_, _))
            .returns(Ok(())),
    );
    rename
        .exclusive(Path::new("before"), Path::new("after"))
        .unwrap();
    let group: &dyn ProcessGroup = &Unimock::new((
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Ok(())),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    group.terminate().unwrap();
    group.kill().unwrap();
    let groups: &dyn ProcessGroups = &Unimock::new(
        ProcessGroupsMock::configure
            .next_call(matching!(_))
            .returns(Ok(())),
    );
    groups.configure(&mut Command::new("fixture")).unwrap();
}

#[test]
fn git_and_sidecar_mocks_are_usable_from_a_downstream_crate() {
    let runner: &dyn Runner =
        &Unimock::new(RunnerMock::run.next_call(matching!(_)).returns(Ok(Output {
            stdout: vec![],
            stderr: vec![],
        })));
    runner
        .run(&command::Request {
            directory: "/fixture".into(),
            args: vec![],
            stdin: vec![],
            output_limit: 100,
        })
        .unwrap();
    let batches: &dyn Batches = &Unimock::new(
        BatchesMock::run
            .next_call(matching!(_, _, _))
            .returns(Ok(vec![])),
    );
    batches.run(Path::new("/fixture"), &[], &[]).unwrap();
    let request = wire::Request {
        id: 0,
        call: Call::Hello(Empty {}),
    };
    let mut transport = Unimock::new((
        TransportMock::send.next_call(matching!(_)).returns(Ok(())),
        TransportMock::receive
            .next_call(matching!())
            .returns(Ok(Frame::Response(Response::Success {
                id: 0,
                result: serde_json::Value::Null,
            }))),
    ));
    let transport: &mut dyn Transport = &mut transport;
    transport.send(&request).unwrap();
    transport.receive().unwrap();
    let mut events = Unimock::new(EventsMock::emit.next_call(matching!(_)).returns(()));
    let events: &mut dyn Events = &mut events;
    events.emit(Event::Diagnostic {
        message: "fixture".into(),
    });
    let mut client = Unimock::new((
        ClientMock::handshake.next_call(matching!()).returns(Ok(())),
        ClientMock::request
            .next_call(matching!(_))
            .returns(Ok(MethodResult::Empty)),
    ));
    let client: &mut dyn SidecarClient = &mut client;
    client.handshake().unwrap();
    client.request(&request).unwrap();
}
