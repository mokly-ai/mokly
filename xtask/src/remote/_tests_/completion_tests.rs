//! A command's own worker downloads evidence and cleans up its box.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::check::request::DependencyAudit;
use crate::remote::cleanup::{BoxCleanup, CleanupGuard};
use crate::remote::contracts::*;
use crate::remote::runner::DefaultRemoteRunner;

#[test]
fn command_workers_download_and_stop_before_the_execution_phase_returns() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let downloads = events.clone();
    let statuses = events.clone();
    let closes = events.clone();
    let stops = events.clone();
    let cancels = events.clone();
    let shared = Arc::new(Unimock::new((
        BlacksmithDisconnectMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                closes.lock().unwrap().push(format!("close:{id}"));
                Ok(Disconnection::Closed)
            })),
        BlacksmithRunMock
            .each_call(matching!(_, _, _))
            .answers(&|_, _, _, _| {
                Ok(Output {
                    code: Some(0),
                    ..Output::default()
                })
            }),
        BlacksmithDownloadMock
            .each_call(matching!("tbx_unit", _, _))
            .answers_arc(Arc::new(move |_, id, source, target| {
                assert_eq!(
                    source,
                    ".context/verification-reports/remote/unit-1-of-4.json"
                );
                assert_eq!(
                    target,
                    &PathBuf::from(
                        "/workspace/.context/verification-reports/remote/run/unit-1-of-4.json"
                    )
                );
                downloads.lock().unwrap().push(format!("download:{id}"));
                Ok(())
            })),
        BlacksmithStatusMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                statuses.lock().unwrap().push(format!("status:{id}"));
                Ok("/actions/runs/123".into())
            })),
        BlacksmithStopMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                stops.lock().unwrap().push(format!("stop:{id}"));
                Ok(())
            })),
        GithubCancelMock
            .each_call(matching!(123))
            .answers_arc(Arc::new(move |_, _| {
                cancels.lock().unwrap().push("cancel".into());
                Ok(())
            })),
        ProgramsFindMock
            .each_call(matching!("gh"))
            .answers(&|_, _| Ok(true)),
        InterruptRequestedMock.each_call(matching!()).returns(false),
        ClockMillisMock.each_call(matching!()).returns(1000u128),
        ReporterProgressMock.each_call(matching!(_)).returns(()),
        ReporterExecutorMock.each_call(matching!(_)).returns(()),
    )));
    let unused = Arc::new(Unimock::new(()));
    let runner = DefaultRemoteRunner {
        dependencies: Dependencies {
            environment: unused.clone(),
            programs: shared.clone(),
            clock: shared.clone(),
            git: unused.clone(),
            blacksmith: shared.clone(),
            github: shared.clone(),
            fingerprint: unused.clone(),
            aggregate: unused.clone(),
            logs: unused,
            interrupt: shared.clone(),
            reporter: shared,
            workspace: PathBuf::from("/workspace"),
        },
    };
    let boxes: Vec<String> = vec![
        "tbx_repository".into(),
        "tbx_package".into(),
        "tbx_unit".into(),
    ];
    let cleanup = CleanupGuard::new(&runner.dependencies);
    for id in &boxes {
        cleanup.track(id);
    }
    assert_eq!(
        runner
            .execute(
                &boxes,
                "sha256:test",
                "run",
                &cleanup,
                DependencyAudit::Baseline,
            )
            .len(),
        3
    );
    assert!(cleanup.pending().is_empty());
    let events = events.lock().unwrap();
    assert!(events.iter().any(|event| event == "download:tbx_unit"));
    for id in boxes {
        let close = events
            .iter()
            .position(|event| event == &format!("close:{id}"))
            .unwrap();
        let status = events
            .iter()
            .position(|event| event == &format!("status:{id}"))
            .unwrap();
        let stop = events
            .iter()
            .position(|event| event == &format!("stop:{id}"))
            .unwrap();
        assert!(status < stop);
        assert!(close < status);
        assert_eq!(
            events
                .iter()
                .filter(|event| **event == format!("close:{id}"))
                .count(),
            1
        );
    }
}
