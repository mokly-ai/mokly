//! Maintenance diagnostics do not replace runtime outcomes or repeat preparation calls.

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_server::changes::ChangeToken;
use mokly_server::usage_completion::UsageCompletionMock;
use mokly_sidecar::early_lease::{EarlyCall, EarlyLease, EarlyLeaseMock, EarlyRetry};
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::workers::DiagnosticsMock;
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::css;

#[derive(Clone, Copy, Debug)]
enum Outcome {
    Deferred,
    Retry,
    RuntimeError,
}

fn timeout() -> Error {
    Error::RequestTimeout {
        call: Box::new(css("/base", 0)),
        deadline_ms: 60_000,
        phase: None,
    }
}

#[test]
fn failed_early_cleanup_reports_once_and_preserves_completed_work_and_runtime_errors() {
    for outcome in [Outcome::Deferred, Outcome::Retry, Outcome::RuntimeError] {
        let (send, receive) = mpsc::channel();
        let waiting = send.clone();
        let (release, released) = mpsc::channel();
        let released = Mutex::new(released);
        let usage = match outcome {
            Outcome::Deferred | Outcome::Retry => Unimock::new((
                UsageCompletionMock::settled
                    .each_call(matching!())
                    .returns(false),
                UsageCompletionMock::observe
                    .some_call(matching!(_))
                    .returns(()),
                UsageCompletionMock::wait
                    .some_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        waiting.send("wait").unwrap();
                        released.lock().unwrap().recv().unwrap();
                        true
                    })),
            )),
            Outcome::RuntimeError => Unimock::new((
                UsageCompletionMock::settled
                    .each_call(matching!())
                    .returns(false),
                UsageCompletionMock::observe
                    .some_call(matching!(_))
                    .returns(()),
            )),
        };
        let early = Unimock::new((
            EarlyLeaseMock::request
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| match outcome {
                    Outcome::Deferred => EarlyCall::Deferred,
                    Outcome::Retry => EarlyCall::Retry(EarlyRetry::new(timeout())),
                    Outcome::RuntimeError => EarlyCall::Complete(Err(Error::Unavailable {
                        part: "runtime".into(),
                    })),
                })),
            EarlyLeaseMock::finish.some_call(matching!()).answers(&|_| {
                Err(Error::HeadReturnDisabled {
                    source: Box::new(Error::Unavailable {
                        part: "cleanup".into(),
                    }),
                })
            }),
        ));
        let lease = Mutex::new(Some(early.clone()));
        let claim = PoolMock::try_early
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                let lease: Box<dyn EarlyLease> = Box::new(lease.lock().unwrap().take().unwrap());
                Ok(Some(lease))
            }));
        let inner = match outcome {
            Outcome::Deferred => Unimock::new((
                claim,
                PoolMock::request.some_call(matching!(_)).answers(&|_, _| {
                    Err(Error::Unavailable {
                        part: "ordinary".into(),
                    })
                }),
            )),
            Outcome::Retry => Unimock::new((
                claim,
                PoolMock::retry
                    .some_call(matching!((_, retry) if matches!(&retry.failure, Error::RequestTimeout { deadline_ms: 60_000, .. })))
                    .answers(&|_, _, _| Err(timeout())),
            )),
            Outcome::RuntimeError => Unimock::new(claim),
        };
        let messages = Arc::new(Mutex::new(Vec::new()));
        let reported = messages.clone();
        let diagnostics = Unimock::new(
            DiagnosticsMock::emit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    reported.lock().unwrap().push(message.to_owned());
                }))
                .n_times(2),
        );
        let scheduler = ServePool::new(Arc::new(inner), 2).with_diagnostics(Arc::new(diagnostics));
        let base = scheduler.preparing(Arc::new(ChangeToken::default()), Arc::new(usage));
        let worker = base.clone();
        let task = thread::spawn(move || {
            let result = worker.request(css("/base", 0));
            send.send("complete").unwrap();
            result
        });
        let first = receive.recv().unwrap();
        let before_usage = scheduler.gate.state.lock().unwrap().active;
        if first == "wait" {
            release.send(()).unwrap();
        }
        let result = task.join().unwrap();
        base.finish();
        base.finish();
        let correct = match (outcome, result) {
            (Outcome::Deferred, Err(Error::Unavailable { part })) => part == "ordinary",
            (
                Outcome::Retry,
                Err(Error::RequestTimeout {
                    deadline_ms: 60_000,
                    phase: None,
                    ..
                }),
            ) => true,
            (Outcome::RuntimeError, Err(Error::Unavailable { part })) => part == "runtime",
            _ => false,
        };
        assert!(correct, "{outcome:?}");
        assert_eq!(
            before_usage,
            usize::from(matches!(outcome, Outcome::RuntimeError))
        );
        assert_eq!(
            first,
            if matches!(outcome, Outcome::RuntimeError) {
                "complete"
            } else {
                "wait"
            }
        );
        assert_eq!(messages.lock().unwrap().len(), 2);
        assert_eq!(scheduler.gate.state.lock().unwrap().active, 0);
    }
}
