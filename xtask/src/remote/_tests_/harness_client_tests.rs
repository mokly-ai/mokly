//! Phase-specific Blacksmith mocks for remote orchestration tests.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

use super::harness_tests::{Case, output};

pub(super) fn client(
    case: Case,
    events: Arc<Mutex<Vec<String>>>,
    interrupted: Arc<AtomicBool>,
) -> Unimock {
    let warmups = Arc::new(AtomicUsize::new(0));
    let probes = Arc::new(AtomicUsize::new(0));
    let stop_attempts = Arc::new(AtomicUsize::new(0));
    let completed_attempts = stop_attempts.clone();
    let warm_events = Arc::clone(&events);
    let warm_signal = Arc::clone(&interrupted);
    let run_events = Arc::clone(&events);
    let run_signal = Arc::clone(&interrupted);
    let download_events = Arc::clone(&events);
    let stop_events = Arc::clone(&events);
    let status_events = Arc::clone(&events);
    let close_events = Arc::clone(&events);
    let disconnect = BlacksmithDisconnectMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            close_events
                .lock()
                .unwrap()
                .push(format!("disconnect:{id}"));
            Ok(Disconnection::Closed)
        }));
    let warmup = BlacksmithWarmupMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, reference| {
            assert_eq!(reference, "feature");
            let index = warmups.fetch_add(1, Ordering::SeqCst);
            let index = if case == Case::RepeatedBox { 0 } else { index };
            warm_events
                .lock()
                .unwrap()
                .push(format!("warm:tbx_{index}"));
            if matches!(case, Case::InterruptWarmup | Case::InterruptCleanupWarmup) {
                warm_signal.store(true, Ordering::SeqCst);
            }
            if index == 0 && case == Case::NoId {
                return Ok(output("none".into(), 0));
            }
            let mut text = if index == 0 && case == Case::MultipleIds {
                format!("tbx_{index}\ntbx_extra\n")
            } else {
                format!("tbx_{index}\n")
            };
            if matches!(
                case,
                Case::WarmupRunId | Case::WarmupRunIdFailure | Case::ProbeRunId | Case::StatusRunId
            ) {
                text.push_str("https://github.com/org/repo/actions/runs/456\n");
            }
            Ok(output(
                text,
                if index == 0
                    && matches!(
                        case,
                        Case::Warmup | Case::CleanupWarmup | Case::WarmupRunIdFailure
                    )
                {
                    1
                } else {
                    0
                },
            ))
        }));
    let run = BlacksmithRunMock
        .each_call(matching!(_, _, _, _))
        .answers_arc(Arc::new(move |_, cwd, id, command, log| {
            assert_eq!(
                cwd,
                std::path::Path::new(
                    "/workspace/.context/verification-snapshots/20261006T120000Z-42"
                )
            );
            if log.is_none() {
                probes.fetch_add(1, Ordering::SeqCst);
                run_events.lock().unwrap().push(format!("probe:{id}"));
                assert!(command.contains("--print-head"));
                if case == Case::ProbeRunIdFailure {
                    return Ok(output(
                        "https://github.com/org/repo/actions/runs/789".into(),
                        1,
                    ));
                }
                if id == "tbx_0" && case == Case::Probe {
                    return Ok(output(String::new(), 1));
                }
                let head = if id == "tbx_0" && case == Case::Head {
                    "c".repeat(40)
                } else {
                    "b".repeat(40)
                };
                let fingerprint = if id == "tbx_0" && case == Case::Fingerprint {
                    "c".repeat(64)
                } else {
                    "a".repeat(64)
                };
                let mut result = output(format!("ready\nsha256:{fingerprint}\n{head}\n"), 0);
                if matches!(case, Case::ProbeRunId | Case::StatusRunId) {
                    result.stderr = "https://github.com/org/repo/actions/runs/789".into();
                }
                return Ok(result);
            }
            assert_eq!(probes.load(Ordering::SeqCst), 11);
            assert!(
                log.unwrap()
                    .to_string_lossy()
                    .contains("20261006T120000Z-42")
            );
            run_events.lock().unwrap().push(format!("suite:{id}"));
            if case == Case::PanicSuites && id == "tbx_0" {
                panic!("suite dependency failed");
            }
            if matches!(case, Case::InterruptSuites | Case::InterruptCleanupSuites) {
                run_signal.store(true, Ordering::SeqCst);
            }
            Ok(output(
                String::new(),
                if matches!(
                    case,
                    Case::Suite | Case::LogUnavailable | Case::CleanupFailedSuite
                ) && command.contains("--suite repository")
                {
                    1
                } else {
                    0
                },
            ))
        }));
    let download = BlacksmithDownloadMock
        .each_call(matching!(_, _, _))
        .answers_arc(Arc::new(move |_, id, source, target| {
            download_events
                .lock()
                .unwrap()
                .push(format!("download:{id}"));
            assert!(target.to_string_lossy().contains("20261006T120000Z-42"));
            if case == Case::Download && source.ends_with("unit-1-of-4.json") {
                return Err(Error::Command {
                    operation: Operation::Blacksmith,
                    code: Some(1),
                    detail: None,
                });
            }
            Ok(())
        }));
    let status = BlacksmithStatusMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            status_events.lock().unwrap().push(format!("status:{id}"));
            if matches!(case, Case::WarmupRunId | Case::WarmupRunIdFailure) {
                return Err(Error::Command {
                    operation: Operation::Blacksmith,
                    code: Some(1),
                    detail: None,
                });
            }
            Ok(
                if id == "tbx_0"
                    && ((case == Case::CompletedOnRetry
                        && completed_attempts.load(Ordering::SeqCst) > 0)
                        || (case == Case::CompletedOnFinal
                            && completed_attempts.load(Ordering::SeqCst) == 3))
                {
                    format!("ID STATUS\n{id} completed\n")
                } else if matches!(
                    case,
                    Case::MissingRun | Case::ProbeRunId | Case::ProbeRunIdFailure
                ) {
                    "no URL".into()
                } else {
                    "https://github.com/org/repo/actions/runs/123".into()
                },
            )
        }));
    let stop = BlacksmithStopMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            stop_events.lock().unwrap().push(format!("stop:{id}"));
            let attempt = if id == "tbx_0" {
                stop_attempts.fetch_add(1, Ordering::SeqCst)
            } else {
                0
            };
            if id == "tbx_0"
                && (matches!(
                    case,
                    Case::CleanupWarmup
                        | Case::CompletedOnFinal
                        | Case::CleanupSuites
                        | Case::CleanupFailedSuite
                        | Case::InterruptCleanupWarmup
                        | Case::InterruptCleanupSuites
                ) || (matches!(case, Case::RetryStop | Case::CompletedOnRetry) && attempt == 0))
            {
                return Err(Error::Command {
                    operation: Operation::Blacksmith,
                    code: Some(1),
                    detail: None,
                });
            }
            Ok(())
        }));
    let common = (
        BlacksmithVersionMock
            .each_call(matching!())
            .answers(&|_| Ok("blacksmith version test".into())),
        BlacksmithListMock
            .each_call(matching!())
            .answers(&|_| Ok(())),
        warmup,
        disconnect,
        status,
        stop,
    );
    if case.preparation_fails()
        && !matches!(
            case,
            Case::Probe | Case::Head | Case::Fingerprint | Case::ProbeRunIdFailure
        )
    {
        Unimock::new(common)
    } else if matches!(
        case,
        Case::Probe
            | Case::Head
            | Case::Fingerprint
            | Case::ProbeRunIdFailure
            | Case::InterruptSuites
            | Case::InterruptCleanupSuites
    ) {
        Unimock::new((common, run))
    } else {
        Unimock::new((common, run, download))
    }
}
