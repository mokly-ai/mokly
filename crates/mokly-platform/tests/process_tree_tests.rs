//! Unix process-tree tests for descendants that leave the owned session.

#[cfg(unix)]
mod unix {
    //! Real Unix process trees with explicit readiness and cleanup.

    use std::io::{BufRead, BufReader};
    use std::process::{Child, Command, Stdio};
    use std::time::{Duration, Instant};

    use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

    struct Tree {
        child: Child,
        group: Box<dyn ProcessGroup>,
        reader: BufReader<std::process::ChildStdout>,
    }

    fn start(script: &str, ignore_term: bool) -> Tree {
        let groups: &dyn ProcessGroups = &SystemProcessGroups;
        let mut command = Command::new("sh");
        command
            .args(["-c", script])
            .env("MOKLY_TEST_PROCESS_EXE", std::env::current_exe().unwrap())
            .env("MOKLY_TEST_IGNORE_TERM", if ignore_term { "1" } else { "" })
            .env(
                "MOKLY_TEST_LABEL",
                if ignore_term {
                    "ignoring"
                } else {
                    "descendant"
                },
            )
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        groups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let reader = BufReader::new(child.stdout.take().unwrap());
        let group = groups.attach(&child).unwrap();
        Tree {
            child,
            group,
            reader,
        }
    }

    fn read_pids(tree: &mut Tree, expected: &str) -> Vec<i32> {
        let mut line = String::new();
        tree.reader.read_line(&mut line).unwrap();
        let mut fields = line.split_whitespace();
        assert_eq!(fields.next(), Some(expected));
        fields.map(|field| field.parse::<i32>().unwrap()).collect()
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
        if let Ok(output) = Command::new("ps")
            .args(["-o", "stat=", "-p", &pid.to_string()])
            .output()
            && String::from_utf8_lossy(&output.stdout)
                .trim_start()
                .starts_with('Z')
        {
            return false;
        }
        // SAFETY: kill with signal zero only queries the process identified by
        // this positive PID. It does not access process memory.
        let result = unsafe { libc::kill(pid, 0) };
        result == 0 || std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
    }

    fn wait_gone(pid: i32) {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if !process_exists(pid) {
                return;
            }
            assert!(Instant::now() < deadline, "process {pid} remains");
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    fn cleanup(tree: &mut Tree, pids: &[i32]) {
        for &pid in pids {
            // SAFETY: Cleanup targets only PIDs reported by the helper. A
            // missing process is harmless and is handled by the OS.
            unsafe { libc::kill(pid, libc::SIGKILL) };
        }
        let _ = tree.group.kill();
        let _ = tree.child.kill();
        let _ = tree.child.wait();
    }

    #[test]
    fn kill_stops_a_descendant_in_a_new_session() {
        let mut tree = start(
            r#""$MOKLY_TEST_PROCESS_EXE" --exact unix::new_session_helper --nocapture 3>&1 1>&2 & wait"#,
            false,
        );
        let pids = read_pids(&mut tree, "descendant");
        assert_eq!(pids.len(), 2);
        assert!(pids.iter().all(|pid| process_exists(*pid)));
        tree.group.kill().unwrap();
        let _ = tree.child.wait();
        for &pid in &pids {
            wait_gone(pid);
        }
        cleanup(&mut tree, &pids);
    }

    #[test]
    fn terminate_then_kill_stops_an_ignoring_new_session_tree() {
        let mut tree = start(
            r#""$MOKLY_TEST_PROCESS_EXE" --exact unix::new_session_helper --nocapture 3>&1 1>&2 & wait"#,
            true,
        );
        let pids = read_pids(&mut tree, "ignoring");
        assert_eq!(pids.len(), 2);
        tree.group.terminate().unwrap();
        tree.group.kill().unwrap();
        let _ = tree.child.wait();
        for &pid in &pids {
            wait_gone(pid);
        }
        cleanup(&mut tree, &pids);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn kill_stops_an_orphan_adopted_by_the_owned_subreaper() {
        let mut tree = start(
            r#"printf 'ready\n'; "$MOKLY_TEST_PROCESS_EXE" --exact unix::orphan_intermediate --nocapture 3>&1 1>&2 & while :; do sleep 1; done"#,
            true,
        );
        let _ = read_pids(&mut tree, "ready");
        let pids = read_pids(&mut tree, "orphan");
        assert_eq!(pids.len(), 1);
        assert!(pids.iter().all(|pid| process_exists(*pid)));
        tree.group.kill().unwrap();
        let _ = tree.child.wait();
        for &pid in &pids {
            wait_gone(pid);
        }
        cleanup(&mut tree, &pids);
    }

    #[test]
    fn new_session_helper() {
        if std::env::var_os("MOKLY_TEST_PROCESS_EXE").is_none() {
            return;
        }
        // SAFETY: This helper has no children or threads yet. It is not the
        // process-group leader because the shell owns the parent group.
        assert!(unsafe { libc::setsid() } >= 0);
        if std::env::var_os("MOKLY_TEST_IGNORE_TERM").is_some_and(|value| value == "1") {
            // SAFETY: SIGTERM is ignored for this isolated helper only.
            unsafe { libc::signal(libc::SIGTERM, libc::SIG_IGN) };
        }
        let ignore_term =
            std::env::var_os("MOKLY_TEST_IGNORE_TERM").is_some_and(|value| value == "1");
        let child_script = if ignore_term {
            "trap '' TERM; exec sleep 1000"
        } else {
            "exec sleep 1000"
        };
        let child = Command::new("sh")
            .args(["-c", child_script])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let label = std::env::var("MOKLY_TEST_LABEL").unwrap_or_else(|_| "descendant".into());
        report(&label, &[std::process::id() as i32, child.id() as i32]);
        loop {
            // SAFETY: pause waits for the signal that ends this helper.
            unsafe { libc::pause() };
        }
    }

    #[test]
    fn orphan_intermediate() {
        if std::env::var_os("MOKLY_TEST_PROCESS_EXE").is_none() {
            return;
        }
        // SAFETY: The helper is still the only process in its original group.
        assert!(unsafe { libc::setsid() } >= 0);
        let child = Command::new("sh")
            .args(["-c", "trap '' TERM; exec sleep 1000"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        report("orphan", &[child.id() as i32]);
    }

    fn report(label: &str, pids: &[i32]) {
        let mut line = label.to_owned();
        for pid in pids {
            line.push_str(&format!(" {pid}"));
        }
        line.push('\n');
        // SAFETY: The shell duplicates the readiness pipe to fd 3. The byte
        // buffer remains alive for the synchronous write.
        let written = unsafe { libc::write(3, line.as_ptr().cast(), line.len()) };
        assert_eq!(written, line.len() as isize);
    }
}
