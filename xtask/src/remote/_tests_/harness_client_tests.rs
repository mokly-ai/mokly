//! Phase-specific Blacksmith mocks for remote orchestration tests.

use super::harness_tests::{Case, output};
use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use unimock::{MockFn, Unimock, matching};

pub(super) fn client(
    case: Case,
    events: Arc<Mutex<Vec<String>>>,
    interrupted: Arc<AtomicBool>,
) -> Unimock {
    let warmups = Arc::new(AtomicUsize::new(0));
    let probes = Arc::new(AtomicUsize::new(0));
    let warm_events = Arc::clone(&events);
    let warm_signal = Arc::clone(&interrupted);
    let run_events = Arc::clone(&events);
    let run_signal = Arc::clone(&interrupted);
    let download_events = Arc::clone(&events);
    let stop_events = Arc::clone(&events);
    let status_events = Arc::clone(&events);
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
            if case == Case::InterruptWarmup {
                warm_signal.store(true, Ordering::SeqCst);
            }
            if index == 0 && case == Case::NoId {
                return Ok(output("none".into(), 0));
            }
            let text = if index == 0 && case == Case::MultipleIds {
                format!("tbx_{index}\ntbx_extra\n")
            } else {
                format!("tbx_{index}\n")
            };
            Ok(output(
                text,
                if index == 0 && matches!(case, Case::Warmup | Case::CleanupWarmup) {
                    1
                } else {
                    0
                },
            ))
        }));
    let run = BlacksmithRunMock
        .each_call(matching!(_, _, _))
        .answers_arc(Arc::new(move |_, id, command, log| {
            if log.is_none() {
                probes.fetch_add(1, Ordering::SeqCst);
                run_events.lock().unwrap().push(format!("probe:{id}"));
                assert!(command.contains("--print-head"));
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
                return Ok(output(format!("ready\nsha256:{fingerprint}\n{head}\n"), 0));
            }
            assert_eq!(probes.load(Ordering::SeqCst), 11);
            assert!(
                log.unwrap()
                    .to_string_lossy()
                    .contains("20261006T120000Z-42")
            );
            run_events.lock().unwrap().push(format!("suite:{id}"));
            if case == Case::InterruptSuites {
                run_signal.store(true, Ordering::SeqCst);
            }
            Ok(output(
                String::new(),
                if case == Case::Suite && command.contains("--suite repository") {
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
                });
            }
            Ok(())
        }));
    let status = BlacksmithStatusMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            status_events.lock().unwrap().push(format!("status:{id}"));
            Ok(if case == Case::MissingRun {
                "no URL".into()
            } else {
                "https://github.com/org/repo/actions/runs/123".into()
            })
        }));
    let stop = BlacksmithStopMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, id| {
            stop_events.lock().unwrap().push(format!("stop:{id}"));
            if case == Case::CleanupWarmup && id == "tbx_0" {
                return Err(Error::Command {
                    operation: Operation::Blacksmith,
                    code: Some(1),
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
        status,
        stop,
    );
    if case.preparation_fails() && !matches!(case, Case::Probe | Case::Head | Case::Fingerprint) {
        Unimock::new(common)
    } else if matches!(
        case,
        Case::Probe | Case::Head | Case::Fingerprint | Case::InterruptSuites
    ) {
        Unimock::new((common, run))
    } else {
        Unimock::new((common, run, download))
    }
}
