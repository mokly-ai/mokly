//! A normally exited manager leaves a survivor that holds both output pipes,
//! and the spawner reaps a manager only after its last tree signal.

#![cfg(unix)]

use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::process::{self, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use mokly_compare::commands::{Command, Commands, Spawner, TimedCommands};
use mokly_compare::error::{Error, Result};
use mokly_compare::process::SystemSpawner;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{Clock, ClockMock, SystemClock, Token};
use mokly_platform::flush::SystemFlush;
use mokly_platform::processes::SystemProcessGroups;
use mokly_test_support::reap_order::{Root, Watched};
use unimock::{MockFn, Unimock, matching};

const MANAGER: &str = r#"
const { spawn } = require('node:child_process');
const script = `
const socket = require('node:net').connect(process.argv[1]);
socket.once('connect', () => socket.write(process.argv[2] + ' ' + process.pid + '\\n'));
socket.once('data', () => process.exit(0));
`;
const child = spawn(process.execPath, ['-e', script, process.argv[1], String(process.pid)], {
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
});
child.unref();
"#;

fn exists(pid: i32) -> bool {
    process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap()
        .success()
}

/// A zombie has exited. The spawner keeps the manager unreaped until its
/// tree guard has sent its last signal.
fn running(pid: i32) -> bool {
    let output = process::Command::new("ps")
        .args(["-o", "stat=", "-p", &pid.to_string()])
        .stderr(Stdio::null())
        .output()
        .unwrap();
    output.status.success()
        && !String::from_utf8_lossy(&output.stdout)
            .trim_start()
            .starts_with('Z')
}

fn wait_manager_gone(pid: i32) {
    let deadline = Instant::now() + Duration::from_secs(10);
    while running(pid) && Instant::now() < deadline {
        thread::yield_now();
    }
    assert!(!running(pid), "manager {pid} did not exit");
}

struct Running {
    _temporary: tempfile::TempDir,
    milliseconds: Arc<AtomicU64>,
    _clock: Unimock,
    cancellation: Arc<Token>,
    worker: Option<JoinHandle<()>>,
    result: Receiver<Result<Vec<u8>>>,
    stream: Option<UnixStream>,
    survivor: Option<i32>,
}

impl Running {
    fn start() -> Self {
        let temporary = tempfile::tempdir().unwrap();
        let socket = temporary.path().join("ready.socket");
        let listener = UnixListener::bind(&socket).unwrap();
        let (ready, readiness) = mpsc::channel();
        thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut line = String::new();
            BufReader::new(stream.try_clone().unwrap())
                .read_line(&mut line)
                .unwrap();
            ready.send((stream, line)).unwrap();
        });
        let milliseconds = Arc::new(AtomicU64::new(0));
        let observed = milliseconds.clone();
        let paused = milliseconds.clone();
        let deadline = Arc::new(AtomicBool::new(false));
        let sampled = deadline.clone();
        let mock_clock = Unimock::new((
            ClockMock::now
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let now = observed.load(Ordering::SeqCst);
                    if now >= 120_000 {
                        sampled.store(true, Ordering::SeqCst);
                    }
                    Duration::from_millis(now)
                })),
            ClockMock::pause
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, duration| {
                    if deadline.load(Ordering::SeqCst) {
                        paused.fetch_add(duration.as_millis() as u64, Ordering::SeqCst);
                    }
                    thread::yield_now();
                })),
        ));
        let clock: Arc<dyn Clock> = Arc::new(mock_clock.clone());
        let cancellation = Arc::new(Token::default());
        let commands = TimedCommands {
            spawner: Arc::new(SystemSpawner {
                groups: Arc::new(SystemProcessGroups),
                clock: clock.clone(),
            }),
            clock,
            cancellation: cancellation.clone(),
            storage: Arc::new(SystemStorage {
                root: temporary.path().to_owned(),
                cancellation: cancellation.clone(),
                flush: Arc::new(SystemFlush),
            }),
        };
        let request = Command {
            program: "node".into(),
            args: vec!["-e".into(), MANAGER.into(), socket.into_os_string()],
            scripts: true,
            directory: temporary.path().to_owned(),
            timeout: Duration::from_secs(120),
            byte_limit: None,
            size_root: None,
            cache: None,
            node: None,
        };
        let (complete, result) = mpsc::channel();
        let worker = thread::spawn(move || complete.send(commands.run(&request)).unwrap());
        let mut running = Self {
            _temporary: temporary,
            milliseconds,
            _clock: mock_clock,
            cancellation,
            worker: Some(worker),
            result,
            stream: None,
            survivor: None,
        };
        let (stream, line) = readiness.recv_timeout(Duration::from_secs(10)).unwrap();
        let pids = line
            .split_whitespace()
            .map(|pid| pid.parse::<i32>().unwrap())
            .collect::<Vec<_>>();
        running.stream = Some(stream);
        running.survivor = Some(pids[1]);
        wait_manager_gone(pids[0]);
        running
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        self.cancellation.cancel();
        self.milliseconds.store(120_000, Ordering::SeqCst);
        if let Some(stream) = &mut self.stream {
            let _ = stream.write_all(b"release");
        }
        if let Some(pid) = self.survivor {
            let _ = process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        if let Some(worker) = self.worker.take() {
            worker.join().unwrap();
        }
    }
}

#[test]
fn timeout_returns_while_an_exited_managers_survivor_still_holds_its_pipes() {
    let running = Running::start();
    assert!(exists(running.survivor.unwrap()));
    assert!(matches!(
        running.result.try_recv(),
        Err(mpsc::TryRecvError::Empty)
    ));
    running.milliseconds.store(120_000, Ordering::SeqCst);
    let result = running.result.recv_timeout(Duration::from_secs(10));
    assert!(
        matches!(result, Ok(Err(Error::InstallTimeout))),
        "stopped result: {result:?}"
    );
    assert!(exists(running.survivor.unwrap()));
    assert_eq!(running.milliseconds.load(Ordering::SeqCst), 120_100);
}

/// The spawner keeps a finished manager unreaped until its last tree signal.
#[test]
fn a_finished_manager_is_reaped_only_after_its_last_tree_signal() {
    let temporary = tempfile::tempdir().unwrap();
    let groups = Arc::new(Watched::default());
    let spawner = SystemSpawner {
        groups: groups.clone(),
        clock: Arc::new(SystemClock::default()),
    };
    let mut child = spawner
        .spawn(&Command {
            program: "node".into(),
            args: vec!["-e".into(), "process.stdout.write('done')".into()],
            scripts: true,
            directory: temporary.path().to_owned(),
            timeout: Duration::from_secs(120),
            byte_limit: None,
            size_root: None,
            cache: None,
            node: None,
        })
        .unwrap();
    let output = child.finish().unwrap();
    drop(child);
    assert!(output.success);
    assert_eq!(output.stdout, b"done");
    let states = groups.states();
    assert!(!states.is_empty(), "no tree signal");
    assert!(
        !states.contains(&Root::Reaped),
        "a tree signal followed the reap: {states:?}"
    );
}
