//! Package-manager supervision tests for detached Node children.

#[cfg(unix)]
mod unix {
    //! Run a Node manager that creates a detached child with ignored stdio.

    use std::io::Read;
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command as OsCommand;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{Duration, Instant};

    use mokly_compare::commands::{Command, Commands, TimedCommands};
    use mokly_compare::error::Error;
    use mokly_compare::process::SystemSpawner;
    use mokly_git::control::{Clock, SystemClock, Token};
    use mokly_platform::flush::SystemFlush;
    use mokly_platform::processes::SystemProcessGroups;

    fn fixture() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
        let temporary = tempfile::tempdir().unwrap();
        let fifo = temporary.path().join("child.pid");
        assert!(
            OsCommand::new("mkfifo")
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
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
        (temporary, script, fifo)
    }

    fn command(
        script: &std::path::Path,
        fifo: &std::path::Path,
        directory: &std::path::Path,
        timeout: Duration,
    ) -> Command {
        Command {
            program: "node".into(),
            args: vec![script.as_os_str().to_owned(), fifo.as_os_str().to_owned()],
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
            std::thread::sleep(duration);
        }
    }

    fn timed(
        cancellation: Arc<Token>,
        clock: Arc<dyn Clock>,
        root: &std::path::Path,
    ) -> TimedCommands {
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

    fn read_pid(fifo: &std::path::Path) -> i32 {
        let mut bytes = Vec::new();
        std::fs::File::open(fifo)
            .unwrap()
            .read_to_end(&mut bytes)
            .unwrap();
        String::from_utf8(bytes)
            .unwrap()
            .trim()
            .parse::<i32>()
            .unwrap()
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
        if let Ok(output) = OsCommand::new("ps")
            .args(["-o", "stat=", "-p", &pid.to_string()])
            .output()
            && String::from_utf8_lossy(&output.stdout)
                .trim_start()
                .starts_with('Z')
        {
            return false;
        }
        OsCommand::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .is_ok_and(|status| status.success())
    }

    fn wait_gone(pid: i32) {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if !process_exists(pid) {
                return;
            }
            assert!(Instant::now() < deadline, "detached child {pid} remains");
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    fn cleanup(pid: i32) {
        let _ = OsCommand::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
    }

    #[test]
    fn timeout_kills_a_detached_node_child() {
        let (temporary, script, fifo) = fixture();
        let cancellation = Arc::new(Token::default());
        let clock = Arc::new(TestClock::new());
        let commands = timed(
            cancellation,
            Arc::clone(&clock) as Arc<dyn Clock>,
            temporary.path(),
        );
        let request = command(&script, &fifo, temporary.path(), Duration::from_secs(120));
        let worker = std::thread::spawn(move || commands.run(&request));
        let pid = read_pid(&fifo);
        assert!(process_exists(pid));
        clock.advance(Duration::from_secs(120));
        assert!(matches!(worker.join().unwrap(), Err(Error::InstallTimeout)));
        wait_gone(pid);
        cleanup(pid);
    }

    #[test]
    fn cancellation_kills_a_detached_node_child() {
        let (temporary, script, fifo) = fixture();
        let cancellation = Arc::new(Token::default());
        let commands = timed(
            Arc::clone(&cancellation),
            Arc::new(SystemClock::default()),
            temporary.path(),
        );
        let request = command(&script, &fifo, temporary.path(), Duration::from_secs(120));
        let worker = std::thread::spawn(move || commands.run(&request));
        let pid = read_pid(&fifo);
        assert!(process_exists(pid));
        cancellation.cancel();
        assert!(matches!(worker.join().unwrap(), Err(Error::Cancelled)));
        wait_gone(pid);
        cleanup(pid);
    }
}
