//! Startup ownership drops and explicit kills share one stop without extra lifecycle calls.

use std::io;
use std::sync::{Arc, Mutex, mpsc};

use mokly_platform::error;
use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::process_control::ProcessControl;
use crate::process_reaper::{ReapMock, reap};
use crate::process_startup::StartupTiming;
use crate::trace_capture::Trace;
use crate::workers::WorkerControl;

struct PendingTask {
    child: Unimock,
    startup: Arc<StartupTiming>,
}

impl Drop for PendingTask {
    fn drop(&mut self) {
        reap(&mut self.child, Some(&self.startup));
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Failure {
    None,
    ChildKill,
    ChildWait,
    GroupKill,
    GroupDrop,
}

#[test]
fn startup_cleanup_in_either_drop_order_keeps_one_parent_and_sticky_failure() {
    for child_first in [false, true] {
        for failure in [
            Failure::None,
            Failure::ChildKill,
            Failure::ChildWait,
            Failure::GroupKill,
            Failure::GroupDrop,
        ] {
            let order = Arc::new(Mutex::new(Vec::new()));
            let killed = order.clone();
            let waited = order.clone();
            let child = Unimock::new((
                ReapMock::kill
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        killed.lock().unwrap().push("child.kill");
                        if failure == Failure::ChildKill {
                            Err(io::ErrorKind::Other.into())
                        } else {
                            Ok(())
                        }
                    })),
                ReapMock::wait
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        waited.lock().unwrap().push("child.wait");
                        if failure == Failure::ChildWait {
                            Err(io::ErrorKind::Other.into())
                        } else {
                            Ok(())
                        }
                    })),
            ));
            let killed = order.clone();
            let dropped = order.clone();
            let group = Unimock::new((
                ProcessGroupMock::kill
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        killed.lock().unwrap().push("group.kill");
                        group_result(failure == Failure::GroupKill)
                    })),
                ProcessGroupMock::kill
                    .next_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        dropped.lock().unwrap().push("group.drop");
                        group_result(failure == Failure::GroupDrop)
                    })),
            ));
            let clock = Unimock::new(());
            let trace = Trace::default();
            tracing::subscriber::with_default(trace.clone(), || {
                let caller = tracing::info_span!("sidecar.spawn", status = "error");
                let _scope = caller.enter();
                let startup = Arc::new(StartupTiming::default());
                let control = control(&group, &clock, &startup);
                if child_first {
                    {
                        let _pending = PendingTask {
                            child: child.clone(),
                            startup: startup.clone(),
                        };
                    }
                    let span = startup.stop();
                    let _scope = span.enter();
                    assert_eq!(control.kill().is_err(), failure == Failure::GroupKill);
                } else {
                    {
                        let span = startup.stop();
                        let _scope = span.enter();
                        assert_eq!(control.kill().is_err(), failure == Failure::GroupKill);
                    }
                    let _pending = PendingTask {
                        child: child.clone(),
                        startup: startup.clone(),
                    };
                }
            });
            let stops = trace.stopped();
            assert_eq!(stops.len(), 1);
            assert_eq!(stops[0].parent.as_ref().unwrap().into_u64(), 1);
            assert_eq!(stops[0].fields["reason"], "retry");
            assert_eq!(
                stops[0].fields["status"],
                if failure == Failure::None {
                    "ok"
                } else {
                    "error"
                }
            );
            let expected = if child_first {
                ["child.kill", "child.wait", "group.kill", "group.drop"]
            } else {
                ["group.kill", "child.kill", "child.wait", "group.drop"]
            };
            assert_eq!(*order.lock().unwrap(), expected);
        }
    }
}

fn group_result(failed: bool) -> error::Result<()> {
    if failed {
        Err(error::Error::Locked {
            path: "private".into(),
        })
    } else {
        Ok(())
    }
}

fn control(group: &Unimock, clock: &Unimock, startup: &Arc<StartupTiming>) -> ProcessControl {
    let (outgoing, _) = mpsc::sync_channel(1);
    let (_, exited) = mpsc::sync_channel(1);
    let (_, drained) = mpsc::sync_channel(1);
    ProcessControl {
        group: Box::new(group.clone()),
        outgoing,
        exited: Mutex::new(exited),
        drained: Mutex::new(drained),
        clock: Arc::new(clock.clone()),
        startup: Arc::downgrade(startup),
    }
}

#[test]
fn successful_handoff_keeps_no_stop_or_parent_for_later_cleanup() {
    let child = Unimock::new((
        ReapMock::kill.next_call(matching!()).returns(Ok(())),
        ReapMock::wait.next_call(matching!()).returns(Ok(())),
    ));
    let trace = Trace::default();
    let startup = Arc::new(StartupTiming::default());
    tracing::subscriber::with_default(trace.clone(), || {
        let caller = tracing::info_span!("sidecar.spawn");
        let _scope = caller.enter();
        startup.hand_off();
    });
    assert!(startup.active().is_disabled());
    tracing::subscriber::with_default(trace.clone(), || {
        let _pending = PendingTask {
            child: child.clone(),
            startup: startup.clone(),
        };
    });
    assert!(trace.stopped().is_empty());
}
