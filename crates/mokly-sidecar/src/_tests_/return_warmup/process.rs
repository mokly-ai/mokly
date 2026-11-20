//! A journaled process mock answers every call that a warm-up scenario sends.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::compiled_fixture::compiled;
use crate::methods::Call;
use crate::results;
use crate::wire::MethodResult;
use crate::workers::{ControlMock, WorkerMock};

use super::support::{Event, Hook, Journal};

/// Each call, quiet flag, kill, and reap reaches the journal; the hook can fail a call or a reap.
pub(super) fn process(id: usize, events: &Arc<Journal>, hook: Hook) -> Unimock {
    let calls = events.clone();
    let kills = events.clone();
    let reaps = events.clone();
    let reaped = hook.clone();
    Unimock::new((
        WorkerMock::handshake
            .each_call(matching!(_))
            .answers(&|_, _| Ok(())),
        WorkerMock::request
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                let label = match &request.call {
                    Call::Bundle(params) => format!("bundle {}", params.params.entry_files[0]),
                    Call::ProcessCss(params) => params.context.clone(),
                    call => call.to_string(),
                };
                if request.quiet {
                    calls.emit(Event::Quiet(id, label.clone()));
                }
                let event = Event::Call(id, label);
                calls.emit(event.clone());
                hook(&event)?;
                Ok(match &request.call {
                    Call::Bundle(params) => MethodResult::Bundle(Box::new(results::Bundle {
                        plan: None,
                        generation: params.params.entry_files[0].clone(),
                        epoch: 0,
                        cache: None,
                        compile_count: 1,
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
        ControlMock::kill
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                kills.emit(Event::Kill(id));
                Ok(())
            })),
        ControlMock::shutdown
            .each_call(matching!())
            .answers(&|_| Ok(())),
        ControlMock::finish
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                reaps.emit(Event::Reap(id));
                reaped(&Event::Reap(id))
            })),
    ))
    .no_verify_in_drop()
}
