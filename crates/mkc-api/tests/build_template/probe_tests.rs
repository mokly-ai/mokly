//! Local template probe tests use unimock and never open a provider connection.

use std::sync::Arc;

use sandbox_interface::{Error, ProcessStreamEvent, ProcessStreamOutcome, SandboxBackendMock};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{SUCCESS, request, sandbox, stream_backend};
use super::probe::{ProbeError, StreamTemplateProbe, TemplateProbe};

#[tokio::test]
async fn streams_one_added_entry_and_destroys_a_verified_candidate() {
    let events = vec![
        ProcessStreamEvent::Stdout(SUCCESS[..20].to_vec()),
        ProcessStreamEvent::Stdout(SUCCESS[20..].to_vec()),
        ProcessStreamEvent::Exited {
            exit_code: 0,
            exited: true,
        },
        ProcessStreamEvent::Outcome(ProcessStreamOutcome::Completed),
    ];
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        backend: stream_backend(events, false),
    };
    assert_eq!(probe.run(request()).await, Ok(()));
}

#[tokio::test]
async fn write_failure_still_destroys_the_candidate() {
    let backend = Unimock::new((
        SandboxBackendMock::create_sandbox
            .some_call(matching!(_))
            .returns(Ok(sandbox())),
        SandboxBackendMock::write_file
            .some_call(matching!(_))
            .returns(Err(Error::internal_message(
                "never-print-this-provider-secret",
            ))),
        SandboxBackendMock::destroy_sandbox
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        backend: Arc::new(backend),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Write));
}
