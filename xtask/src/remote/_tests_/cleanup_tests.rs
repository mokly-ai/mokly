//! Cleanup keeps every box covered when optional or required calls fail.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::cleanup::{BoxCleanup, CleanupGuard};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use crate::remote::runner::DefaultRemoteRunner;

#[path = "disconnect_cleanup_tests.rs"]
mod disconnect_cleanup_tests;

#[test]
fn cleanup_continues_after_status_stop_and_optional_github_failures() {
    for case in 0..5 {
        let events = Arc::new(Mutex::new(Vec::new()));
        let status_events = events.clone();
        let close_events = events.clone();
        let stop_events = events.clone();
        let cancel_events = events.clone();
        let shared = Arc::new(Unimock::new((
            BlacksmithDisconnectMock.each_call(matching!(_)).answers_arc(Arc::new(move |_, id| {
                close_events.lock().unwrap().push(format!("close:{id}"));
                Ok(Disconnection::Closed)
            })),
            ProgramsFindMock
                .next_call(matching!("gh"))
                .answers_arc(Arc::new(move |_, _| {
                    if case == 1 {
                        Err(Error::Io {
                            operation: Operation::Program,
                            source: std::io::Error::other("lookup failed"),
                        })
                    } else {
                        Ok(case != 0)
                    }
                })),
            BlacksmithStatusMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, id| {
                    status_events.lock().unwrap().push(format!("status:{id}"));
                    if case == 2 && id == "tbx_a" {
                        Err(Error::Command {
                            operation: Operation::Blacksmith,
                            code: Some(1),
                        })
                    } else if case == 4 && id == "tbx_a" {
                        Ok("ID STATUS REPO\ntbx_other completed mokly\ntbx_a completed mokly\n/actions/runs/123".into())
                    } else {
                        Ok("https://github.com/org/repo/actions/runs/123".into())
                    }
                })),
            BlacksmithStopMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, id| {
                    stop_events.lock().unwrap().push(format!("stop:{id}"));
                    if case == 3 && id == "tbx_a" {
                        Err(Error::Command {
                            operation: Operation::Blacksmith,
                            code: Some(1),
                        })
                    } else {
                        Ok(())
                    }
                })),
            ReporterExecutorMock.each_call(matching!(_)).returns(()),
        )));
        let github = Arc::new(if case < 2 {
            Unimock::new(())
        } else {
            Unimock::new(
                GithubCancelMock
                    .each_call(matching!(123))
                    .answers_arc(Arc::new(move |_, _| {
                        cancel_events.lock().unwrap().push("cancel".into());
                        Ok(())
                    })),
            )
        });
        let unused = Arc::new(Unimock::new(()));
        let runner = DefaultRemoteRunner {
            dependencies: Dependencies {
                environment: unused.clone(),
                programs: shared.clone(),
                clock: Arc::new(if case == 3 {
                    Unimock::new(ClockWaitMock.each_call(matching!(_)).returns(()))
                } else {
                    Unimock::new(())
                }),
                git: unused.clone(),
                blacksmith: shared.clone(),
                github,
                fingerprint: unused.clone(),
                aggregate: unused.clone(),
                logs: unused.clone(),
                interrupt: unused,
                reporter: shared,
                workspace: PathBuf::from("/workspace"),
            },
        };
        let cleanup = CleanupGuard::new(&runner.dependencies);
        cleanup.track("tbx_a");
        cleanup.track("tbx_b");
        assert_eq!(
            cleanup.stop_boxes(&["tbx_b".into(), "tbx_a".into(), "tbx_b".into()]),
            usize::from(case == 3)
        );
        let events = events.lock().unwrap();
        for id in ["tbx_a", "tbx_b"] {
            assert_eq!(
                events
                    .iter()
                    .filter(|event| **event == format!("close:{id}"))
                    .count(),
                1
            );
            assert!(
                events
                    .iter()
                    .position(|event| *event == format!("close:{id}"))
                    < events
                        .iter()
                        .position(|event| *event == format!("status:{id}"))
            );
            assert_eq!(
                events
                    .iter()
                    .filter(|event| **event == format!("stop:{id}"))
                    .count(),
                if case == 3 && id == "tbx_a" {
                    3
                } else {
                    usize::from(case != 4 || id != "tbx_a")
                }
            );
            if case == 4 && id == "tbx_a" {
                continue;
            }
            assert!(
                events
                    .iter()
                    .position(|event| *event == format!("status:{id}"))
                    < events
                        .iter()
                        .position(|event| *event == format!("stop:{id}"))
            );
        }
        assert_eq!(
            events.iter().filter(|event| **event == "cancel").count(),
            match case {
                2 | 4 => 1,
                3 => 2,
                _ => 0,
            }
        );
    }
}
