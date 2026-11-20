//! Strict backend and sink expectations for a complete attempt.

use std::collections::{BTreeMap, VecDeque};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::TimeDelta;
use futures_util::stream;
use mkc_build_interface::log::{BuildLogChunk, BuildLogSink, BuildLogSinkMock};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::request::BuildRequest;
use mkc_build_interface::runner::BuildRunner;
use sandbox_interface::{Error as SandboxError, SandboxBackend, SandboxBackendMock};
use unimock::{MockFn, Unimock, matching};

use crate::clock::{BuildClock, BuildClockMock};
use crate::runner::SandboxBuildRunner;

use super::fixtures::{INSTALLATION, UPLOAD, create, now, provider, sandbox};
use super::script::Call;

pub(super) struct Harness {
    pub(super) request: BuildRequest,
    pub(super) backend: Arc<dyn SandboxBackend>,
    pub(super) sink: Arc<dyn BuildLogSink>,
    pub(super) clock: Arc<dyn BuildClock>,
    pub(super) chunks: Arc<Mutex<Vec<BuildLogChunk>>>,
    pub(super) steps: Arc<Mutex<Vec<BuildStep>>>,
    pub(super) destroys: Arc<AtomicUsize>,
    calls: Arc<Mutex<VecDeque<Call>>>,
}

impl Harness {
    pub(super) fn new(request: BuildRequest, calls: Vec<Call>) -> Self {
        Self::with_sink(request, calls, None)
    }

    pub(super) fn with_sink(
        request: BuildRequest,
        calls: Vec<Call>,
        sink: Option<Arc<dyn BuildLogSink>>,
    ) -> Self {
        Self::with_cleanup(request, calls, sink, false)
    }

    pub(super) fn with_destroy_failure(request: BuildRequest, calls: Vec<Call>) -> Self {
        Self::with_cleanup(request, calls, None, true)
    }

    fn with_cleanup(
        request: BuildRequest,
        calls: Vec<Call>,
        sink: Option<Arc<dyn BuildLogSink>>,
        destroy_fails: bool,
    ) -> Self {
        let has_process = !calls.is_empty();
        let plans = Arc::new(Mutex::new(VecDeque::from(calls)));
        let script = plans.clone();
        let time = Arc::new(Mutex::new(now()));
        let stream_time = time.clone();
        let destroys = Arc::new(AtomicUsize::new(0));
        let destroy_count = destroys.clone();
        let budget = request
            .deadline_at
            .signed_duration_since(now())
            .num_seconds()
            .max(0) as u64;
        let expected_create = create(&request, (budget + 120).min(3600));
        let operation = request.attempt_operation_id;
        let project_id = request.project_id;
        let common = (
            SandboxBackendMock::create_sandbox
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, actual| {
                    assert_eq!(actual, expected_create);
                    Ok(sandbox())
                })),
            SandboxBackendMock::write_file
                .next_call(matching!(_))
                .answers_arc(Arc::new(|_, actual| {
                    assert_eq!(actual.sandbox_provider_ref, provider());
                    assert_eq!(actual.root, "/home/user");
                    assert_eq!(actual.path, ".mokly-git-credentials");
                    assert_eq!(
                        actual.bytes,
                        format!("https://x-access-token:{INSTALLATION}@github.com\n").as_bytes()
                    );
                    assert!(!format!("{actual:?}").contains(INSTALLATION));
                    Ok(())
                })),
            SandboxBackendMock::destroy_sandbox
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, actual| {
                    assert_eq!(actual, provider());
                    destroy_count.fetch_add(1, Ordering::SeqCst);
                    if destroy_fails {
                        Err(SandboxError::internal_message(INSTALLATION))
                    } else {
                        Ok(())
                    }
                })),
        );
        let processes = SandboxBackendMock::stream_process
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                let call = script
                    .lock()
                    .unwrap()
                    .pop_front()
                    .expect("unexpected process");
                assert_eq!(actual.sandbox_provider_ref, provider());
                assert_eq!(actual.command, call.program);
                assert_eq!(actual.args, call.args);
                assert_eq!(actual.cwd.as_deref(), Some(call.cwd.as_str()));
                let mut envs: BTreeMap<String, String> = [
                    ("CI", "1"),
                    ("NO_COLOR", "1"),
                    ("FORCE_COLOR", "0"),
                    ("GIT_TERMINAL_PROMPT", "0"),
                    ("COREPACK_ENABLE_DOWNLOAD_PROMPT", "0"),
                ]
                .into_iter()
                .map(|(k, v)| (k.into(), v.into()))
                .collect();
                if call.publish {
                    envs.insert(
                        "MOKLY_ENDPOINT".into(),
                        format!("https://api.mokly.ai/v1/projects/{project_id}/publications"),
                    );
                    envs.insert("MOKLY_TOKEN".into(), UPLOAD.into());
                }
                assert_eq!(actual.envs, envs);
                assert_eq!(actual.stdout_limit, 64 * 1024 * 1024);
                assert_eq!(actual.stderr_limit, 64 * 1024 * 1024);
                assert_eq!(actual.deadline, Duration::from_secs(call.budget));
                let idle = match call.step {
                    BuildStep::Checkout => 120,
                    BuildStep::Install => 300,
                    BuildStep::Publish => call.budget,
                }
                .min(call.budget);
                assert_eq!(actual.idle_timeout, Duration::from_secs(idle));
                for token in [INSTALLATION, UPLOAD] {
                    assert!(!format!("{actual:?}").contains(token));
                    assert!(!actual.command.contains(token));
                    assert!(actual.args.iter().all(|arg| !arg.contains(token)));
                }
                *stream_time.lock().unwrap() += TimeDelta::seconds(call.advance);
                match call.error {
                    Some(error) => Err(error),
                    None => Ok(call
                        .stream
                        .unwrap_or_else(|| Box::pin(stream::iter(call.events)))),
                }
            }));
        let backend: Arc<dyn SandboxBackend> = if has_process {
            Arc::new(Unimock::new((common, processes)))
        } else {
            Arc::new(Unimock::new(common))
        };
        let chunks = Arc::new(Mutex::new(Vec::new()));
        let output = chunks.clone();
        let steps = Arc::new(Mutex::new(Vec::new()));
        let progress = steps.clone();
        let sink: Arc<dyn BuildLogSink> = sink.unwrap_or_else(|| {
            Arc::new(Unimock::new((
                BuildLogSinkMock::step_started
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, attempt, step| {
                        assert_eq!(attempt, operation);
                        progress.lock().unwrap().push(step);
                        Ok(())
                    })),
                BuildLogSinkMock::write
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, chunk| {
                        assert_eq!(chunk.attempt_operation_id, operation);
                        assert!(!chunk.bytes.is_empty());
                        assert!(chunk.bytes.len() <= 65536);
                        let text = String::from_utf8_lossy(&chunk.bytes);
                        for token in [INSTALLATION, UPLOAD] {
                            assert!(!text.contains(token));
                        }
                        output.lock().unwrap().push(chunk);
                        Ok(())
                    })),
            )))
        });
        let clock_time = time.clone();
        let clock: Arc<dyn BuildClock> = Arc::new(Unimock::new(
            BuildClockMock::now
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| *clock_time.lock().unwrap())),
        ));
        Self {
            request,
            backend,
            sink,
            clock,
            chunks,
            steps,
            destroys,
            calls: plans,
        }
    }

    pub(super) async fn run(&self) -> BuildOutcome {
        let runner: &dyn BuildRunner = &SandboxBuildRunner::new(
            self.backend.clone(),
            self.clock.clone(),
            "test-builds".into(),
        )
        .unwrap();
        let outcome = runner.run(self.request.clone(), self.sink.clone()).await;
        assert!(
            self.calls.lock().unwrap().is_empty(),
            "some expected processes did not run"
        );
        assert_eq!(self.destroys.load(Ordering::SeqCst), 1);
        for token in [INSTALLATION, UPLOAD] {
            assert!(!format!("{outcome:?}").contains(token));
            assert!(!format!("{:?}", self.request).contains(token));
        }
        outcome
    }
}
