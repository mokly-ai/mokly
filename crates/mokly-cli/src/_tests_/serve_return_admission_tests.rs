//! Serve admission exposes waiting base work to the weak maintenance driver.

use std::sync::{Arc, Mutex};
use std::thread;

use mokly_cli::cancellation::ServeCancellation;
use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::foreground::Foreground;
use mokly_sidecar::error::Error;
use mokly_sidecar::pool::{PoolMock, ReturnWake};
use unimock::{MockFn, Unimock, matching};

use crate::serve_pool::serve_pool_support::capacity;
use crate::serve_pool::{PoolScheduling, ServePool};
use crate::serve_progress::ServeProgress;
use crate::serve_return::ReturnAdmission;
use crate::terminal::TerminalMock;

use super::serve_pool_support::css;

#[test]
fn waiting_base_admission_defers_returns_until_the_wait_is_cancelled() {
    let inner = Unimock::new(());
    let scheduler = ServePool::new(Arc::new(inner.clone()), capacity(1));
    let _foreground = scheduler.enter();
    let cancellation: Arc<dyn ChangeCancellation> = Arc::new(ChangeToken::default());
    let base = scheduler.pool(Some(cancellation.clone()));
    let request = thread::spawn(move || base.request(css("/base", 0)));
    {
        let mut state = scheduler.gate.state.lock().unwrap();
        while state.waiting_base == 0 {
            state = scheduler.gate.changed.wait(state).unwrap();
        }
    }
    let admission: &dyn ReturnAdmission = scheduler.gate.as_ref();
    let blocked = admission.ready();
    cancellation.cancel();
    assert!(matches!(request.join().unwrap(), Err(Error::Cancelled)));
    assert!(!blocked);
    assert!(admission.ready());
}

#[test]
fn a_background_return_failure_reaches_the_terminal_without_timing_output() {
    for disabled in [false, true] {
        let lines = Arc::new(Mutex::new(Vec::new()));
        let observed = lines.clone();
        let terminal = Unimock::new(TerminalMock::stderr.each_call(matching!(_)).answers_arc(
            Arc::new(move |_, line| {
                observed.lock().unwrap().push(line.to_owned());
            }),
        ));
        let diagnostics = Arc::new(ServeProgress::new(
            Style {
                mode: Mode::Plain,
                color: false,
                ascii: true,
                columns: 120,
            },
            Arc::new(terminal.clone()),
            Arc::new(ServeCancellation::default()),
            false,
        ))
        .diagnostics(Arc::new(Redactor::default()));
        let inner = Unimock::new(PoolMock::maintain_head_return.stub(|each| {
            each.call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let source = Error::Unavailable {
                        part: "injected".into(),
                    };
                    Err(if disabled {
                        Error::HeadReturnDisabled {
                            source: Box::new(source),
                        }
                    } else {
                        source
                    })
                }))
                .once()
                .then()
                .answers(&|_| Ok(false));
        }));
        let scheduler =
            ServePool::new(Arc::new(inner.clone()), capacity(1)).with_diagnostics(diagnostics);
        let wake = scheduler
            .gate
            .return_wake
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .clone();
        wake.notify();
        wake.synchronize();
        let expected = if disabled {
            vec![
                "[mokly-sidecar/sidecar-unavailable] injected is unavailable\n",
                "[mokly/warning] Background sidecar preparation is disabled. Restart Serve.\n",
            ]
        } else {
            vec!["[mokly-sidecar/sidecar-unavailable] injected is unavailable\n"]
        };
        assert_eq!(*lines.lock().unwrap(), expected, "disabled: {disabled}");
    }
}
