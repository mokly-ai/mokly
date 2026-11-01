//! Package-manager supervision tests for detached Node children.

#[cfg(unix)]
mod unix {
    //! Run a Node manager that creates a detached child with ignored stdio.

    use std::io::Read;
    use std::path::{Path, PathBuf};
    use std::process;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::mpsc;
    use std::thread::JoinHandle;
    use std::time::{Duration, Instant};

    use mokly_compare::commands::{Command, Commands, TimedCommands};
    use mokly_compare::error::{Error, Result};
    use mokly_compare::process::SystemSpawner;
    use mokly_git::control::{Clock, SystemClock, Token};
    use mokly_platform::flush::SystemFlush;
    use mokly_platform::processes::SystemProcessGroups;

    fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let temporary = tempfile::tempdir().unwrap();
        let fifo = temporary.path().join("child.pid");
        assert!(
            process::Command::new("mkfifo")
                .arg(&fifo)
                .status()
                .unwrap()
                .success()
        );
        let script = temporary.path().join("manager.js");
        std::fs::write(
            &script,
            r#"const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fifo = process.argv[2];
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  detached: true,
  stdio: 'ignore',
});
fs.writeFileSync(fifo, String(child.pid));
setInterval(() => {}, 1000);
"#,
        )
        .unwrap();
        (temporary, script, fifo)
    }

    fn command(script: &Path, fifo: &Path, directory: &Path, timeout: Duration) -> Command {
        Command {
            program: "node".into(),
            args: vec![script.as_os_str().to_owned(), fifo.as_os_str().to_owned()],
            scripts: true,
            directory: directory.to_owned(),
            timeout,
            byte_limit: None,
            size_root: None,
            cache: None,
            node: None,
        }
    }

    struct TestClock {
        milliseconds: AtomicU64,
    }

    impl TestClock {
        fn new() -> Self {
            Self {
                milliseconds: AtomicU64::new(0),
            }
        }

        fn advance(&self, duration: Duration) {
            self.milliseconds
                .fetch_add(duration.as_millis() as u64, Ordering::Release);
        }
    }

    impl Clock for TestClock {
        fn now(&self) -> Duration {
            Duration::from_millis(self.milliseconds.load(Ordering::Acquire))
        }

        fn pause(&self, duration: Duration) {
            SystemClock::default().pause(duration);
        }
    }

    fn timed(cancellation: Arc<Token>, clock: Arc<dyn Clock>, root: &Path) -> TimedCommands {
        TimedCommands {
            spawner: Arc::new(SystemSpawner {
                groups: Arc::new(SystemProcessGroups),
            }),
            clock,
            cancellation,
            storage: Arc::new(mokly_compare::storage::SystemStorage {
                root: root.to_owned(),
                cancellation: Arc::new(Token::default()),
                flush: Arc::new(SystemFlush),
            }),
        }
    }

    fn read_pid(fifo: &Path) -> i32 {
        let fifo = fifo.to_owned();
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || {
            let mut bytes = String::new();
            std::fs::File::open(fifo)
                .unwrap()
                .read_to_string(&mut bytes)
                .unwrap();
            sender.send(bytes.trim().parse::<i32>().unwrap()).unwrap();
        });
        receiver.recv_timeout(Duration::from_secs(10)).unwrap()
    }

    fn process_exists(pid: i32) -> bool {
        #[cfg(target_os = "linux")]
        if let Ok(stat) = std::fs::read_to_string(format!("/proc/{pid}/stat"))
            && stat
                .rsplit_once(')')
                .and_then(|(_, fields)| fields.split_whitespace().next())
                .is_some_and(|state| state == "Z")
        {
            return false;
        }
        #[cfg(target_os = "macos")]
        if let Ok(output) = process::Command::new("ps")
            .args(["-o", "stat=", "-p", &pid.to_string()])
            .output()
            && String::from_utf8_lossy(&output.stdout)
                .trim_start()
                .starts_with('Z')
        {
            return false;
        }
        process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stdout(process::Stdio::null())
            .stderr(process::Stdio::null())
            .status()
            .is_ok_and(|status| status.success())
    }

    fn wait_gone(pid: i32) {
        let deadline = Instant::now() + Duration::from_secs(10);
        while process_exists(pid) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(
            !process_exists(pid),
            "detached child {pid} remains after the tree stop"
        );
    }

    struct Running {
        _temporary: tempfile::TempDir,
        cancellation: Arc<Token>,
        worker: Option<JoinHandle<Result<Vec<u8>>>>,
        pid: Option<i32>,
    }

    impl Running {
        fn start(clock: Arc<dyn Clock>) -> Self {
            let (temporary, script, fifo) = fixture();
            let cancellation = Arc::new(Token::default());
            let commands = timed(Arc::clone(&cancellation), clock, temporary.path());
            let request = command(&script, &fifo, temporary.path(), Duration::from_secs(120));
            let worker = std::thread::spawn(move || commands.run(&request));
            let mut running = Self {
                _temporary: temporary,
                cancellation,
                worker: Some(worker),
                pid: None,
            };
            running.pid = Some(read_pid(&fifo));
            running
        }

        fn finish(&mut self) -> Result<Vec<u8>> {
            self.worker.take().unwrap().join().unwrap()
        }
    }

    impl Drop for Running {
        fn drop(&mut self) {
            self.cancellation.cancel();
            if let Some(pid) = self.pid {
                let _ = process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .stdout(process::Stdio::null())
                    .stderr(process::Stdio::null())
                    .status();
            }
            if let Some(worker) = self.worker.take() {
                let _ = worker.join();
            }
        }
    }

    #[test]
    fn timeout_kills_a_detached_node_child() {
        let clock = Arc::new(TestClock::new());
        let mut running = Running::start(Arc::clone(&clock) as Arc<dyn Clock>);
        let pid = running.pid.unwrap();
        assert!(process_exists(pid));
        assert!(!running.worker.as_ref().unwrap().is_finished());
        clock.advance(Duration::from_secs(121));
        assert!(matches!(running.finish(), Err(Error::InstallTimeout)));
        wait_gone(pid);
    }

    #[test]
    fn cancellation_kills_a_detached_node_child() {
        let mut running = Running::start(Arc::new(SystemClock::default()));
        let pid = running.pid.unwrap();
        assert!(process_exists(pid));
        running.cancellation.cancel();
        assert!(matches!(running.finish(), Err(Error::Cancelled)));
        wait_gone(pid);
    }
}
