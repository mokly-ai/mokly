//! Local template probe tests use unimock and never open a provider connection.

use sandbox_interface::{
    Error, ProcessStreamEvent, ProcessStreamOutcome, SandboxFilesMock, SandboxLifecycleMock,
};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::{SUCCESS, capabilities, request, sandbox, stream_backend};
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
        sandbox: stream_backend(events, false),
    };
    assert_eq!(probe.run(request()).await, Ok(()));
}

#[tokio::test]
async fn write_failure_still_destroys_the_candidate() {
    let backend = Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .some_call(matching!(_))
            .returns(Ok(sandbox())),
        SandboxFilesMock::write_file
            .some_call(matching!(_))
            .returns(Err(Error::internal_message(
                "never-print-this-provider-secret",
            ))),
        SandboxLifecycleMock::destroy_sandbox
            .some_call(matching!(_))
            .returns(Ok(())),
    ));
    let probe: &dyn TemplateProbe = &StreamTemplateProbe {
        sandbox: capabilities(backend),
    };
    assert_eq!(probe.run(request()).await, Err(ProbeError::Write));
}
