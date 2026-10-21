//! Tracked Git admission closes before cancellation waits for active operations.

use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_git::command::{Output, Request, Runner, RunnerMock};
use mokly_git::error::Error;
use mokly_server::changes::ChangeToken;
use unimock::{MockFn, Unimock, matching};

use crate::serve_git::{GitRunnersMock, GitWork, ServeGit};

fn request() -> Request {
    Request {
        directory: "fixture".into(),
        args: vec!["status".into()],
        stdin: Vec::new(),
        output_limit: 1024,
        stderr_limit: 1024,
    }
}

#[test]
fn closed_admission_rejects_every_runner_operation() {
    let runner: Arc<dyn Runner> = Arc::new(Unimock::new(()));
    let runners = Unimock::new(
        GitRunnersMock::create
            .next_call(matching!(_))
            .returns(runner),
    );
    let git = ServeGit::new(Arc::new(runners.clone()));
    let runner = git.runner(Arc::new(ChangeToken::default()));
    git.cancel();
    assert!(matches!(runner.checkpoint(), Err(Error::Cancelled)));
    assert!(matches!(runner.run(&request()), Err(Error::Cancelled)));
    assert!(matches!(runner.digest(&request()), Err(Error::Cancelled)));
    assert!(matches!(
        runner.copy(&request(), &mut Vec::new(), 0),
        Err(Error::Cancelled)
    ));
    assert!(matches!(
        runner.run_cancellable(&request(), &Unimock::new(())),
        Err(Error::Cancelled)
    ));
    assert!(matches!(
        runner.run_cancellable_with_environment(
            &request(),
            &Unimock::new(()),
            &[("GIT_INDEX_FILE", "index".into())],
        ),
        Err(Error::Cancelled)
    ));
    assert!(matches!(
        runner.run_cancellable_with_environment_timeout(
            &request(),
            &Unimock::new(()),
            &[("GIT_INDEX_FILE", "index".into())],
            Duration::from_secs(1),
        ),
        Err(Error::Cancelled)
    ));
    assert!(matches!(
        runner.digest_cancellable_with_environment_timeout(
            &request(),
            &Unimock::new(()),
            &[("LC_ALL", "C".into())],
            Duration::from_secs(120),
        ),
        Err(Error::Cancelled)
    ));
    assert!(matches!(
        runner.stream_cancellable_with_environment_timeout(
            &request(),
            &Unimock::new(()),
            &[("LC_ALL", "C".into())],
            Duration::from_secs(120),
            &mut Vec::new(),
            32,
        ),
        Err(Error::Cancelled)
    ));
}

#[test]
fn checkout_environment_and_timeout_reach_the_inner_runner() {
    let inner = Unimock::new((
        RunnerMock::run_cancellable_with_environment_timeout
            .next_call(matching!((req, _, environment, timeout) if **req == request() && *environment == [("GIT_INDEX_FILE", "index".into())] && *timeout == Duration::from_secs(1)))
            .returns(Ok(Output {
                stdout: Vec::new(),
                stderr: Vec::new(),
            })),
        RunnerMock::digest_cancellable_with_environment_timeout
            .next_call(matching!((req, _, environment, timeout) if **req == request() && *environment == [("LC_ALL", "C".into())] && *timeout == Duration::from_secs(120)))
            .returns(Ok("converted-digest".into())),
        RunnerMock::stream_cancellable_with_environment_timeout
            .next_call(matching!((req, _, environment, timeout, _, limit) if **req == request() && *environment == [("LC_ALL", "C".into())] && *timeout == Duration::from_secs(120) && *limit == 32))
            .answers(&|_, _, _, _, _, output, _| { output.write_all(b"converted").unwrap(); Ok(()) }),
    ));
    let inner: Arc<dyn Runner> = Arc::new(inner);
    let runners = Unimock::new(
        GitRunnersMock::create
            .next_call(matching!(_))
            .returns(inner),
    );
    let git = ServeGit::new(Arc::new(runners));
    let runner = git.runner(Arc::new(ChangeToken::default()));
    runner
        .run_cancellable_with_environment_timeout(
            &request(),
            &Unimock::new(()),
            &[("GIT_INDEX_FILE", "index".into())],
            Duration::from_secs(1),
        )
        .unwrap();
    assert_eq!(
        runner
            .digest_cancellable_with_environment_timeout(
                &request(),
                &Unimock::new(()),
                &[("LC_ALL", "C".into())],
                Duration::from_secs(120),
            )
            .unwrap(),
        "converted-digest"
    );
    let mut bytes = Vec::new();
    runner
        .stream_cancellable_with_environment_timeout(
            &request(),
            &Unimock::new(()),
            &[("LC_ALL", "C".into())],
            Duration::from_secs(120),
            &mut bytes,
            32,
        )
        .unwrap();
    assert_eq!(bytes, b"converted");
}

#[test]
fn shutdown_cancels_the_active_runner_and_waits_for_its_drain() {
    let (entered, entering) = mpsc::channel();
    let (release, released) = mpsc::channel();
    let released = Arc::new(Mutex::new(released));
    let original = Arc::new(Mutex::new(None));
    let retained = original.clone();
    let runners = Unimock::new(GitRunnersMock::create.next_call(matching!(_)).answers_arc(
        Arc::new(move |_, cancellation| {
            let entered = entered.clone();
            let released = released.clone();
            let runner = Unimock::new(RunnerMock::run.next_call(matching!(_)).answers_arc(
                Arc::new(move |_, _| {
                    entered.send(cancellation.clone()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                    assert!(cancellation.cancelled());
                    Ok(Output {
                        stdout: Vec::new(),
                        stderr: Vec::new(),
                    })
                }),
            ));
            let shared: Arc<dyn Runner> = Arc::new(runner.clone());
            *retained.lock().unwrap() = Some(runner);
            shared
        }),
    ));
    let git = Arc::new(ServeGit::new(Arc::new(runners.clone())));
    let runner = git.runner(Arc::new(ChangeToken::default()));
    let active = runner.clone();
    let work = std::thread::spawn(move || active.run(&request()));
    let cancellation = entering.recv().unwrap();
    assert!(!cancellation.cancelled());
    let stopping = git.clone();
    let (done, completion) = mpsc::channel();
    let stop = std::thread::spawn(move || {
        stopping.cancel();
        done.send(()).unwrap();
    });
    while !cancellation.cancelled() {
        std::thread::yield_now();
    }
    assert!(completion.try_recv().is_err());
    assert!(matches!(runner.run(&request()), Err(Error::Cancelled)));
    release.send(()).unwrap();
    work.join().unwrap().unwrap();
    completion.recv().unwrap();
    stop.join().unwrap();
}
