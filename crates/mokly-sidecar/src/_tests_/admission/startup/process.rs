//! Injected process outcomes and lifecycle events for admission regressions.

use std::collections::VecDeque;
use std::io;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, InternalError};
use crate::methods::Call;
use crate::results::Css;
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, FactoryMock, SpawnFailure, Spawned, WorkerMock};

use super::support::{Event, Journal};

#[derive(Clone, Copy)]
pub(super) enum Mode {
    Ready,
    Missing,
    NotStartedInternal,
    StartedInternal,
    HelloFailure,
}

pub(super) fn factory(
    modes: &[Mode],
    events: &Arc<Journal>,
    hook: Arc<dyn Fn(Event) + Send + Sync>,
) -> Unimock {
    let attempts = Mutex::new(modes.iter().copied().enumerate().collect::<VecDeque<_>>());
    let events = events.clone();
    Unimock::new((
        FactoryMock::spawn
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, launch| {
                let (id, mode) = attempts.lock().unwrap().pop_front().unwrap();
                let event = Event::Spawn(id, launch.repository.to_string_lossy().into_owned());
                events.emit(event.clone());
                hook(event);
                if matches!(mode, Mode::Missing) {
                    return Err(SpawnFailure::NotStarted(Error::Unavailable {
                        part: "injected".into(),
                    }));
                }
                if matches!(mode, Mode::NotStartedInternal | Mode::StartedInternal) {
                    let error = InternalError::Io {
                        source: io::Error::other("injected"),
                    }
                    .into();
                    return Err(if matches!(mode, Mode::StartedInternal) {
                        SpawnFailure::Started(error)
                    } else {
                        SpawnFailure::NotStarted(error)
                    });
                }
                Ok(worker(id, mode, &events, hook.clone()))
            })),
        ClockMock::now_ms.each_call(matching!()).returns(0_u64),
    ))
    .no_verify_in_drop()
}

fn worker(
    id: usize,
    mode: Mode,
    events: &Arc<Journal>,
    hook: Arc<dyn Fn(Event) + Send + Sync>,
) -> Spawned {
    let request_events = events.clone();
    let request_hook = hook.clone();
    let kill_events = events.clone();
    let kill_hook = hook.clone();
    let reap_events = events.clone();
    let worker = Unimock::new((
        WorkerMock::handshake
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                if matches!(mode, Mode::HelloFailure) {
                    Err(Error::Crashed)
                } else {
                    Ok(())
                }
            })),
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                if let Call::ProcessCss(params) = &request.call {
                    let event = Event::Request(id, params.context.clone());
                    request_events.emit(event.clone());
                    request_hook(event);
                }
                Ok(MethodResult::Css(Css {
                    text: id.to_string(),
                    read_evidence: Default::default(),
                    dependencies: vec![],
                    unmapped_dependency_directories: None,
                }))
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
        ControlMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
        ControlMock::kill
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let event = Event::Kill(id);
                kill_events.emit(event.clone());
                kill_hook(event);
                Ok(())
            })),
        ControlMock::finish
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let event = Event::Reap(id);
                reap_events.emit(event.clone());
                hook(event);
                Ok(())
            })),
    ))
    .no_verify_in_drop();
    Spawned {
        worker: Box::new(worker.clone()),
        control: Arc::new(worker),
    }
}
