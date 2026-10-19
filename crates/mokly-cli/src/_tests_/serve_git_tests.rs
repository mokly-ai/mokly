//! Tracked Git admission closes before cancellation waits for active operations.

use std::sync::{Arc, Mutex, mpsc};

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
