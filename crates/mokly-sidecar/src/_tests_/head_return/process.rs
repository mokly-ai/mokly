//! Test-thread process mocks define only the lifecycle calls that a scenario uses.

use std::collections::{BTreeMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::compiled_fixture::compiled;
use crate::error::{Error, Result};
use crate::methods::Call;
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{ClockMock, ControlMock, FactoryMock, SpawnFailure, Spawned, WorkerMock};

use super::support::{Event, Journal};

#[derive(Clone, Copy)]
pub(super) enum Mode {
    Foreground,
    Base,
    Ready,
    Hello,
    ShutdownHello,
    IdleShutdown,
    Retired,
}

pub(super) struct Fault {
    pub(super) event: Event,
    pub(super) used: AtomicBool,
}

fn fail(fault: &Option<Arc<Fault>>, event: &Event) -> Result<()> {
    if fault
        .as_ref()
        .is_some_and(|fault| fault.event == *event && !fault.used.swap(true, Ordering::SeqCst))
    {
        return Err(Error::Unavailable {
            part: "injected".into(),
        });
    }
    Ok(())
}

pub(super) fn processes(
    modes: &[Mode],
    events: &Arc<Journal>,
    hook: Arc<dyn Fn(Event) + Send + Sync>,
    fault: Option<Arc<Fault>>,
) -> (Vec<Unimock>, Unimock) {
    let mut owners = Vec::new();
    let mut processes = VecDeque::new();
    for (id, mode) in modes.iter().enumerate() {
        let worker = worker(id, *mode, events, hook.clone(), fault.clone());
        processes.push_back((
            id,
            Spawned {
                worker: Box::new(worker.clone()),
                control: Arc::new(worker.clone()),
            },
        ));
        owners.push(worker);
    }
    let processes = Mutex::new(processes);
    let observed = events.clone();
    let spawn = FactoryMock::spawn
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, launch| {
            let id = processes.lock().unwrap().front().unwrap().0;
            let event = Event::Spawn(id, launch.repository.to_string_lossy().into_owned());
            observed.emit(event.clone());
            hook(event.clone());
            if let Err(error) = fail(&fault, &event) {
                return Err(SpawnFailure::NotStarted(error));
            }
            Ok(processes.lock().unwrap().pop_front().unwrap().1)
        }));
    let needs_clock = modes
        .iter()
        .any(|mode| !matches!(mode, Mode::Foreground | Mode::Ready));
    let factory = if needs_clock {
        Unimock::new((
            spawn,
            ClockMock::now_ms.each_call(matching!()).returns(100_u64),
        ))
    } else {
        Unimock::new(spawn)
    };
    (owners, factory)
}

fn worker(
    id: usize,
    mode: Mode,
    events: &Arc<Journal>,
    hook: Arc<dyn Fn(Event) + Send + Sync>,
    fault: Option<Arc<Fault>>,
) -> Unimock {
    let hello_events = events.clone();
    let hello_hook = hook.clone();
    let hello_fault = fault.clone();
    let hello = WorkerMock::handshake
        .some_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| {
            hello_events.emit(Event::Hello(id));
            hello_hook(Event::Hello(id));
            fail(&hello_fault, &Event::Hello(id))
        }));
    let request_events = events.clone();
    let request_hook = hook.clone();
    let generations = Mutex::new(BTreeMap::<String, String>::new());
    let exchange = (
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let label = match &request.call {
                    Call::ProcessCss(params) => params.context.clone(),
                    Call::Bundle(params) => params.params.entry_files[0].clone(),
                    _ => request.call.to_string(),
                };
                let event = Event::Request(id, label);
                request_events.emit(event.clone());
                request_hook(event);
                let compile_count = match &request.call {
                    Call::RestoreGeneration(recipe) => {
                        generations
                            .lock()
                            .unwrap()
                            .insert(recipe.generation.clone(), recipe.compiled.identity.clone());
                        0
                    }
                    Call::Dispose(generation) => {
                        generations.lock().unwrap().remove(&generation.generation);
                        0
                    }
                    Call::Bundle(params) => {
                        let identity = &params.params.entry_files[0];
                        let mut generations = generations.lock().unwrap();
                        let count = u64::from(!generations.values().any(|value| value == identity));
                        generations.insert(identity.clone(), identity.clone());
                        count
                    }
                    _ => 0,
                };
                Ok(match &request.call {
                    Call::Bundle(params) => MethodResult::Bundle(Box::new(results::Bundle {
                        plan: None,
                        generation: params.params.entry_files[0].clone(),
                        epoch: 0,
                        cache: None,
                        compile_count,
                        compiled: Arc::new(compiled(&params.params.entry_files[0])),
                        modules: vec![],
                        unmapped_dependency_directories: None,
                    })),
                    _ => MethodResult::Empty,
                })
            })),
        WorkerMock::resident_bytes
            .each_call(matching!())
            .answers(&|_| Ok(0)),
    );
    let kill_events = events.clone();
    let kill_hook = hook.clone();
    let kill = ControlMock::kill
        .each_call(matching!())
        .answers_arc(Arc::new(move |_| {
            kill_events.emit(Event::Kill(id));
            kill_hook(Event::Kill(id));
            Ok(())
        }));
    let reap_events = events.clone();
    let reap_hook = hook.clone();
    let finish = ControlMock::finish
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, _| {
            reap_events.emit(Event::Reap(id));
            reap_hook(Event::Reap(id));
            fail(&fault, &Event::Reap(id))
        }));
    let shutdown_events = events.clone();
    let shutdown = ControlMock::shutdown
        .each_call(matching!())
        .answers_arc(Arc::new(move |_| {
            shutdown_events.emit(Event::Shutdown(id));
            Ok(())
        }));
    match mode {
        Mode::Foreground => Unimock::new((hello, exchange, kill)),
        Mode::Base => Unimock::new((hello, exchange, kill, finish)),
        Mode::Ready => Unimock::new((hello, kill)),
        Mode::Hello => Unimock::new((hello, kill, finish)),
        Mode::ShutdownHello => Unimock::new((hello, kill, finish, shutdown)),
        Mode::IdleShutdown => Unimock::new((hello, exchange, finish, shutdown)),
        Mode::Retired => Unimock::new((hello, exchange, kill, finish, shutdown)),
    }
}
