//! Failed candidate assertions, ambiguous creates and bounded cleanup.

use std::sync::Arc;

use futures_util::stream;
use sandbox_interface::{
    BackendCreateSandboxRequest, BackendStreamProcessRequest, Error, ProcessStreamEvent,
    ProcessStreamOutcome, SandboxFilesMock, SandboxLifecycleMock, SandboxProcessesMock,
};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{SUCCESS, capabilities, request, sandbox, stream_backend};
use super::probe::{ProbeError, StreamTemplateProbe, TemplateProbe};

#[tokio::test]
async fn rejects_nonzero_signal_missing_exit_missing_outcome_wrong_output_and_overflow() {
    for (output, exit, outcome) in [
        (SUCCESS.to_vec(), Some((1, true)), true),
        (SUCCESS.to_vec(), Some((0, false)), true),
        (SUCCESS.to_vec(), None, true),
        (SUCCESS.to_vec(), Some((0, true)), false),
        (b"not the assertion".to_vec(), Some((0, true)), true),
        (vec![b'x'; 32769], Some((0, true)), true),
    ] {
        let mut events = vec![ProcessStreamEvent::Stdout(output)];
        if let Some((exit_code, exited)) = exit {
            events.push(ProcessStreamEvent::Exited { exit_code, exited });
        }
        if outcome {
            events.push(ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed));
        }
        let probe: &dyn TemplateProbe = &StreamTemplateProbe {
            sandbox: stream_backend(events, false),
        };
        assert_eq!(probe.run(request()).await, Err(ProbeError::Assertion));
    }
}

#[tokio::test]
async fn every_failed_stream_outcome_and_event_after_completion_fails_and_cleans_up() {
    for outcome in [
        ProcessStreamOutcome::StdoutOverflow,
        ProcessStreamOutcome::StderrOverflow,
        ProcessStreamOutcome::IdleTimeout,
        ProcessStreamOutcome::ConsumerBackpressure,
        ProcessStreamOutcome::DeadlineExpired,
        ProcessStreamOutcome::TransportFailure,
    ] {
        let probe: &dyn TemplateProbe = &StreamTemplateProbe {
            sandbox: stream_backend(vec![ProcessStreamEvent::Outcome(outcome)], false),
        };
        assert_eq!(probe.run(request()).await, Err(ProbeError::Assertion));
    }
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: stream_backend(
            vec![
                ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
                ProcessStreamEvent::Stdout(SUCCESS.to_vec()),
            ],
            false,
        ),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Assertion));
}

#[tokio::test]
async fn failed_destroy_refuses_a_release_and_excludes_provider_error_text() {
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: stream_backend(
            vec![
                ProcessStreamEvent::Stdout(SUCCESS.to_vec()),
                ProcessStreamEvent::Exited {
                    exit_code: 0,
                    exited: true,
                },
                ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
            ],
            true,
        ),
    };
    let result = probe.run(request()).await;
    assert_eq!(result, Err(ProbeError::Destroy));
    assert!(!format!("{result:?}").contains("provider-secret"));
}

#[tokio::test]
async fn ambiguous_create_recovers_the_same_request_without_replaying_creation() {
    let create = request();
    let expected = create.clone();
    let backend = Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .some_call(matching!(_))
            .returns(Err(Error::internal_message("private-provider-text"))),
        SandboxLifecycleMock::recover_sandbox_create
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual: BackendCreateSandboxRequest| {
                assert_eq!(actual, expected);
                Ok(Some(sandbox()))
            })),
        SandboxFilesMock::write_file
            .some_call(matching!(_))
            .returns(Err(Error::UnknownProfile)),
        SandboxLifecycleMock::destroy_sandbox
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: capabilities(backend),
    };
    assert_eq!(probe.run(create).await, Err(ProbeError::Write));
}

#[tokio::test]
async fn unrecovered_create_fails_without_dispatching_processes() {
    let backend = Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .some_call(matching!(_))
            .returns(Err(Error::UnknownProfile)),
        SandboxLifecycleMock::recover_sandbox_create
            .some_call(matching!(_))
            .returns(Ok(None)),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: capabilities(backend),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Create));
}

#[tokio::test(start_paused = true)]
async fn a_stalled_stream_times_out_and_still_destroys_the_candidate() {
    let backend = Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .some_call(matching!(_))
            .returns(Ok(sandbox())),
        SandboxFilesMock::write_file
            .some_call(matching!(_))
            .returns(Ok(())),
        SandboxProcessesMock::stream_process
            .some_call(matching!(_))
            .answers(&|_, _: BackendStreamProcessRequest| Ok(Box::pin(stream::pending()))),
        SandboxLifecycleMock::destroy_sandbox
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: capabilities(backend),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Timeout));
}

#[tokio::test]
async fn stream_dispatch_failure_still_destroys_the_candidate() {
    let backend = Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .some_call(matching!(_))
            .returns(Ok(sandbox())),
        SandboxFilesMock::write_file
            .some_call(matching!(_))
            .returns(Ok(())),
        SandboxProcessesMock::stream_process
            .some_call(matching!(_))
            .answers(&|_, _: BackendStreamProcessRequest| {
                Err(Error::internal_message("private-provider-text"))
            }),
        SandboxLifecycleMock::destroy_sandbox
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: capabilities(backend),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Stream));
}
