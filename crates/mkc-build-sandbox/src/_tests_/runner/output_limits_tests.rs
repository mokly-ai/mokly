//! Real byte cap enforcement and timed coalescing against scripted streams.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures_util::{StreamExt, stream};
use mkc_build_interface::log::{BuildLogSink, BuildLogSinkMock, BuildStream};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use sandbox_interface::{Error, ProcessStreamEvent, ProcessStreamOutcome};
use tokio::time::sleep;
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{UPLOAD, request};
use super::script::checkout;
use super::support::Harness;

#[tokio::test]
async fn sandbox_stream_open_errors_are_safe_and_destroy_the_sandbox() {
    let mut call = checkout().remove(0);
    call.error = Some(Error::internal_message(UPLOAD));
    assert!(matches!(
        Harness::new(request(), vec![call]).run().await,
        BuildOutcome::Infrastructure(_)
    ));
}

#[tokio::test]
async fn malformed_terminal_order_flushes_only_the_valid_output_prefix() {
    let mut call = checkout().remove(0);
    call.events = vec![
        ProcessStreamEvent::Stdout(b"valid output\n".to_vec()),
        ProcessStreamEvent::Exited {
            exit_code: 0,
            exited: true,
        },
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
        ProcessStreamEvent::Stdout(b"invalid later output\n".to_vec()),
    ];
    let harness = Harness::new(request(), vec![call]);
    assert!(matches!(
        harness.run().await,
        BuildOutcome::Infrastructure(_)
    ));
    let bytes: Vec<_> = harness
        .chunks
        .lock()
        .unwrap()
        .iter()
        .filter(|chunk| chunk.stream == BuildStream::Stdout)
        .flat_map(|chunk| chunk.bytes.clone())
        .collect();
    assert_eq!(bytes, b"valid output\n");
}

#[tokio::test]
async fn enforces_the_byte_cap_even_if_a_backend_exceeds_it() {
    for stderr in [false, true] {
        let mut call = checkout().remove(0);
        let event = if stderr {
            ProcessStreamEvent::Stderr
        } else {
            ProcessStreamEvent::Stdout
        };
        call.events = (0..1025).map(|_| event(vec![b'x'; 64])).collect();
        let harness = Harness::with_output_limit(request(), vec![call], 64 * 1024);
        assert!(matches!(
            harness.run().await,
            BuildOutcome::OutputOverflow {
                step: BuildStep::Checkout
            }
        ));
        let channel = if stderr {
            BuildStream::Stderr
        } else {
            BuildStream::Stdout
        };
        let bytes: usize = harness
            .chunks
            .lock()
            .unwrap()
            .iter()
            .filter(|chunk| chunk.stream == channel)
            .map(|chunk| chunk.bytes.len())
            .sum();
        assert_eq!(bytes, 64 * 1024);
    }
}

#[tokio::test(start_paused = true)]
async fn timer_delivers_a_complete_line_before_the_process_ends() {
    assert_timer_delivery(b"first line\n").await;
}

#[tokio::test(start_paused = true)]
async fn timer_delivers_line_free_output_before_the_process_ends() {
    assert_timer_delivery(b"first progress ").await;
}

async fn assert_timer_delivery(prefix: &'static [u8]) {
    let ended = Arc::new(AtomicBool::new(false));
    let process_ended = ended.clone();
    let first_line = Arc::new(AtomicBool::new(false));
    let saw_line = first_line.clone();
    let output = [prefix, &[b'x'; 200]].concat();
    let mut call = checkout().remove(0);
    call.stream = Some(Box::pin(
        stream::iter([
            ProcessStreamEvent::Started { pid: 42 },
            ProcessStreamEvent::Stdout(output),
        ])
        .chain(stream::once(async move {
            sleep(Duration::from_secs(2)).await;
            process_ended.store(true, Ordering::SeqCst);
            ProcessStreamEvent::Exited {
                exit_code: 1,
                exited: true,
            }
        }))
        .chain(stream::iter([ProcessStreamEvent::Outcome(
            ProcessStreamOutcome::Completed,
        )])),
    ));
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new((
        BuildLogSinkMock::step_started
            .next_call(matching!(_, _))
            .returns(Ok(())),
        BuildLogSinkMock::write
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, chunk| {
                if chunk.stream == BuildStream::Stdout && chunk.bytes.starts_with(prefix) {
                    if prefix.ends_with(b"\n") {
                        assert_eq!(chunk.bytes, prefix);
                    }
                    assert!(!ended.load(Ordering::SeqCst));
                    saw_line.store(true, Ordering::SeqCst);
                }
                Ok(())
            })),
    )));
    assert!(matches!(
        Harness::with_sink(request(), vec![call], Some(sink))
            .run()
            .await,
        BuildOutcome::StepFailed { .. }
    ));
    assert!(first_line.load(Ordering::SeqCst));
}
