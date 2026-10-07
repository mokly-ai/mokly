//! Real child cancellation, descendant termination and cleanup completion.

use std::fs;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, mpsc};
use std::thread;
use std::time::Duration;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::{TestDirectory, wait_for};
use crate::remote::contracts::ClockSleepMock;
use crate::remote::process::Process;

use super::process_adapter_support::{process, request};

struct ChildPids(Vec<u32>);

impl ChildPids {
    fn stop(&self) {
        for pid in &self.0 {
            let _ = Command::new("kill")
                .args(["-KILL", "--", &pid.to_string()])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
}

impl Drop for ChildPids {
    fn drop(&mut self) {
        self.stop();
    }
}

fn alive(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", "--", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap()
        .success()
}

#[test]
fn interrupt_removes_the_child_and_its_sleep_grandchild() {
    let directory = TestDirectory::new();
    let interrupted = Arc::new(AtomicBool::new(false));
    let process = process(interrupted.clone(), Arc::new(Unimock::new(())));
    let request = request(
        directory.path(),
        "sleep 30 & printf '%s %s\n' \"$$\" \"$!\" > pids; wait",
    );
    let path = directory.path().join("pids");
    let (sender, receiver) = mpsc::channel();
    let (ready, running, mut pids, output) = thread::scope(|scope| {
        let child = scope.spawn(|| sender.send(process.execute(&request)).unwrap());
        let ready = wait_for(|| {
            fs::read_to_string(&path).is_ok_and(|text| text.split_whitespace().count() == 2)
        });
        let pids = ChildPids(
            fs::read_to_string(&path)
                .unwrap_or_default()
                .split_whitespace()
                .map(|pid| pid.parse::<u32>().unwrap())
                .collect(),
        );
        let running = ready && pids.0.iter().copied().all(alive);
        interrupted.store(true, Ordering::SeqCst);
        let output = receiver.recv_timeout(Duration::from_secs(10));
        if output.is_err() {
            pids.stop();
        }
        child.join().unwrap();
        (ready, running, pids, output)
    });
    assert!(ready, "the child must publish both process IDs");
    assert!(running, "both processes must exist before the interrupt");
    let output = output
        .expect("cancellation must not leave output readers blocked")
        .unwrap();
    assert_eq!(output.code, None);
    assert!(wait_for(|| pids.0.iter().copied().all(|pid| !alive(pid))));
    pids.0.clear();
}

#[test]
fn non_cancellable_child_finishes_after_an_interrupt() {
    let directory = TestDirectory::new();
    let interrupted = Arc::new(AtomicBool::new(false));
    let mut process = process(interrupted.clone(), Arc::new(Unimock::new(())));
    let (polled_sender, polled_receiver) = mpsc::channel();
    let polled = AtomicUsize::new(0);
    let clock_interrupt = interrupted.clone();
    process.clock = Arc::new(Unimock::new(
        ClockSleepMock
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if clock_interrupt.load(Ordering::SeqCst)
                    && polled.fetch_add(1, Ordering::SeqCst) == 1
                {
                    let _ = polled_sender.send(());
                }
                thread::yield_now();
            })),
    ));
    let mut request = request(
        directory.path(),
        "printf ready > ready; while [ ! -f release ]; do sleep 0.01; done; \
         printf 'cleanup complete'; printf 'cleanup stderr' >&2",
    );
    request.cancellable = false;
    let (sender, receiver) = mpsc::channel();
    let (ready, observed, pending, output) = thread::scope(|scope| {
        let child = scope.spawn(|| sender.send(process.execute(&request)).unwrap());
        let ready = wait_for(|| directory.path().join("ready").is_file());
        interrupted.store(true, Ordering::SeqCst);
        let observed = polled_receiver
            .recv_timeout(Duration::from_secs(10))
            .is_ok();
        let early = receiver.try_recv();
        let pending = matches!(&early, Err(mpsc::TryRecvError::Empty));
        fs::write(directory.path().join("release"), []).unwrap();
        let output = match early {
            Ok(output) => output,
            Err(_) => receiver.recv_timeout(Duration::from_secs(10)).unwrap(),
        };
        child.join().unwrap();
        (ready, observed, pending, output.unwrap())
    });
    assert!(ready);
    assert!(observed, "the poll loop must continue after the interrupt");
    assert!(pending, "the child must still await the release signal");
    assert!(output.success());
    assert_eq!(output.stdout, "cleanup complete");
    assert_eq!(output.stderr, "cleanup stderr");
}
