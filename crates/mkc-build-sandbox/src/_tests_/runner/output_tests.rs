//! Stream outcomes, redaction, independent reading and absolute budgets.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use chrono::TimeDelta;
use futures_util::{StreamExt, stream};
use mkc_build_interface::log::{BuildLogSink, BuildLogSinkMock, BuildStream};
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use sandbox_interface::{ProcessStreamEvent, ProcessStreamOutcome};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{INSTALLATION, UPLOAD, request};
use super::script::{checkout, complete, events};
use super::support::Harness;

#[tokio::test]
async fn maps_every_terminal_stream_outcome_and_destroys_the_sandbox() {
    for outcome in [
        ProcessStreamOutcome::IdleTimeout,
        ProcessStreamOutcome::DeadlineExpired,
        ProcessStreamOutcome::StdoutOverflow,
        ProcessStreamOutcome::StderrOverflow,
        ProcessStreamOutcome::ConsumerBackpressure,
        ProcessStreamOutcome::TransportFailure,
    ] {
        let mut call = checkout().remove(0);
        call.events = vec![ProcessStreamEvent::Outcome(outcome)];
        let harness = Harness::new(request(), vec![call]);
        let actual = harness.run().await;
        match outcome {
            ProcessStreamOutcome::IdleTimeout => assert!(matches!(
                actual,
                BuildOutcome::TimedOut {
                    step: BuildStep::Checkout,
                    budget: BuildBudget::Idle
                }
            )),
            ProcessStreamOutcome::DeadlineExpired => assert!(matches!(
                actual,
                BuildOutcome::TimedOut {
                    step: BuildStep::Checkout,
                    budget: BuildBudget::Deadline
                }
            )),
            ProcessStreamOutcome::StdoutOverflow | ProcessStreamOutcome::StderrOverflow => {
                assert!(matches!(
                    actual,
                    BuildOutcome::OutputOverflow {
                        step: BuildStep::Checkout
                    }
                ))
            }
            _ => assert!(matches!(actual, BuildOutcome::Infrastructure(_))),
        }
    }
}

#[tokio::test]
async fn absent_and_signal_exit_statuses_fail_without_a_code() {
    for events in [
        vec![ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed)],
        vec![
            ProcessStreamEvent::Exited {
                exit_code: 0,
                exited: false,
            },
            ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
        ],
    ] {
        let mut call = checkout().remove(0);
        call.events = events;
        assert!(matches!(
            Harness::new(request(), vec![call]).run().await,
            BuildOutcome::StepFailed {
                step: BuildStep::Checkout,
                exit_code: None,
                cli_error: None
            }
        ));
    }
}

#[tokio::test]
async fn stream_eof_without_a_terminal_outcome_is_infrastructure_failure() {
    let mut call = checkout().remove(0);
    call.events = vec![ProcessStreamEvent::Exited {
        exit_code: 0,
        exited: true,
    }];
    assert!(matches!(
        Harness::new(request(), vec![call]).run().await,
        BuildOutcome::Infrastructure(_)
    ));
}

#[tokio::test]
async fn redacts_split_tokens_independently_in_both_streams_before_chunks_leave() {
    let mut calls = complete();
    let raw = format!("begin {INSTALLATION} and {UPLOAD}\n");
    let mut output = vec![ProcessStreamEvent::Started { pid: 9 }];
    for byte in raw.bytes() {
        output.push(ProcessStreamEvent::Stdout(vec![byte]));
        output.push(ProcessStreamEvent::Stderr(vec![byte]));
    }
    output.extend([
        ProcessStreamEvent::Exited {
            exit_code: 0,
            exited: true,
        },
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
    ]);
    calls[0].events = output;
    let harness = Harness::new(request(), calls);
    assert!(matches!(harness.run().await, BuildOutcome::Completed));
    for stream in [BuildStream::Stdout, BuildStream::Stderr] {
        let bytes: Vec<_> = harness
            .chunks
            .lock()
            .unwrap()
            .iter()
            .filter(|chunk| chunk.stream == stream)
            .flat_map(|chunk| chunk.bytes.clone())
            .collect();
        assert_eq!(bytes, b"begin [redacted] and [redacted]\n");
    }
}

#[tokio::test]
async fn coalesces_large_output_and_cuts_valid_utf8_chunks() {
    let mut calls = complete();
    let text = "é".repeat(70000) + "\nlast line";
    calls[0].events = events(0, &text, "");
    let harness = Harness::new(request(), calls);
    assert!(matches!(harness.run().await, BuildOutcome::Completed));
    let chunks = harness.chunks.lock().unwrap();
    let stdout: Vec<_> = chunks
        .iter()
        .filter(|chunk| chunk.stream == BuildStream::Stdout)
        .collect();
    assert!(stdout.len() >= 3);
    for chunk in &stdout {
        assert!(str::from_utf8(&chunk.bytes).is_ok());
    }
    assert_eq!(
        stdout
            .iter()
            .flat_map(|chunk| chunk.bytes.clone())
            .collect::<Vec<_>>(),
        text.as_bytes()
    );
}

#[tokio::test]
async fn reads_all_ready_events_before_the_sink_runs() {
    let read = Arc::new(AtomicUsize::new(0));
    let count = read.clone();
    let mut call = checkout().remove(0).exit(1);
    call.stream = Some(Box::pin(stream::iter(call.events.clone()).inspect(
        move |_| {
            count.fetch_add(1, Ordering::SeqCst);
        },
    )));
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new((
        BuildLogSinkMock::step_started
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(|_, _, _| Ok(()))),
        BuildLogSinkMock::write
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                assert_eq!(
                    read.load(Ordering::SeqCst),
                    5,
                    "sink ran on the provider reading task"
                );
                Ok(())
            })),
    )));
    let harness = Harness::with_sink(request(), vec![call], Some(sink));
    assert!(matches!(
        harness.run().await,
        BuildOutcome::StepFailed { .. }
    ));
}

#[tokio::test]
async fn absolute_budget_decreases_across_checkout_install_and_publish() {
    let mut calls = complete();
    for (index, call) in calls.iter_mut().enumerate() {
        call.budget = 900 - index as u64 * 100;
        call.advance = 100;
    }
    assert!(matches!(
        Harness::new(request(), calls).run().await,
        BuildOutcome::Completed
    ));
}

#[tokio::test]
async fn no_time_left_stops_before_the_next_process() {
    let mut call = checkout().remove(0);
    call.advance = 900;
    assert!(matches!(
        Harness::new(request(), vec![call]).run().await,
        BuildOutcome::TimedOut {
            step: BuildStep::Checkout,
            budget: BuildBudget::Deadline
        }
    ));
}

#[tokio::test]
async fn idle_budget_is_never_above_the_remaining_deadline() {
    let mut request = request();
    request.deadline_at -= TimeDelta::seconds(870);
    let mut calls = complete();
    for call in &mut calls {
        call.budget = 30;
    }
    assert!(matches!(
        Harness::new(request, calls).run().await,
        BuildOutcome::Completed
    ));
}

#[tokio::test]
async fn every_process_is_capped_at_3600_seconds_and_the_sandbox_at_3720() {
    let mut request = request();
    request.deadline_at += TimeDelta::seconds(10000);
    let mut calls = complete();
    for call in &mut calls {
        call.budget = 3600;
    }
    assert!(matches!(
        Harness::new(request, calls).run().await,
        BuildOutcome::Completed
    ));
}

#[tokio::test(start_paused = true)]
async fn pending_provider_stream_stops_at_the_local_absolute_budget() {
    let mut call = checkout().remove(0);
    call.stream = Some(Box::pin(stream::pending()));
    let harness = Harness::new(request(), vec![call]);
    assert!(matches!(
        harness.run().await,
        BuildOutcome::TimedOut {
            budget: BuildBudget::Deadline,
            ..
        }
    ));
    assert!(
        harness
            .chunks
            .lock()
            .unwrap()
            .iter()
            .any(|chunk| chunk.bytes == b"stopped at the time limit\n")
    );
}
