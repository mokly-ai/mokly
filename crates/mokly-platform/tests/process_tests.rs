//! Process group integration tests synchronized by a readiness line.

#[cfg(unix)]
mod unix {
    //! Real Unix process trees.

    use std::env;
    use std::io::{BufRead, BufReader, Read};
    use std::process::{Command, Stdio};

    use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

    #[test]
    fn owned_process_group_terminates_descendants_and_closes_pipes() {
        let groups: &dyn ProcessGroups = &SystemProcessGroups;
        let mut command = Command::new("sh");
        command
            .args(["-c", "sh -c \"$MOKLY_TEST_PARENT\" <&0 & wait"])
            .env("MOKLY_TEST_PARENT", r#"trap 'printf "descendant-stopped\n"; exit 0' TERM; "$MOKLY_TEST_PROCESS_EXE" --exact unix::signal_leaf_helper --nocapture 3>&1 1>&2 & wait"#)
            .env("MOKLY_TEST_PROCESS_EXE", env::current_exe().unwrap())
            .env("MOKLY_TEST_SIGNAL_LEAF", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        groups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        // Child::wait closes its stdin. Keep this writer until stdout drains
        // so reaping the leader cannot change the descendant's input.
        let _input = child.stdin.take().unwrap();
        let group = groups.attach(&child).unwrap();
        let mut reader = BufReader::new(child.stdout.take().unwrap());
        let mut ready = String::new();
        reader.read_line(&mut ready).unwrap();
        assert_eq!(ready, "ready\n");
        group.terminate().unwrap();
        assert!(!child.wait().unwrap().success());
        let mut remaining = String::new();
        reader.read_to_string(&mut remaining).unwrap();
        let mut lines: Vec<_> = remaining.lines().collect();
        lines.sort();
        assert_eq!(lines, ["descendant-stopped", "leaf-stopped"]);
        group.kill().unwrap();
    }

    #[test]
    fn signal_leaf_helper() {
        if env::var_os("MOKLY_TEST_SIGNAL_LEAF").is_none() {
            return;
        }
        // SAFETY: the handler uses only async-signal-safe calls. It applies
        // to every thread of this isolated helper before readiness is sent.
        let previous = unsafe {
            libc::signal(
                libc::SIGTERM,
                leaf_stopped as *const () as libc::sighandler_t,
            )
        };
        assert_ne!(previous, libc::SIG_ERR);
        // SAFETY: the parent shell duplicates the readiness pipe to fd 3.
        // The static byte slice remains valid for this synchronous write.
        assert_eq!(unsafe { libc::write(3, b"ready\n".as_ptr().cast(), 6) }, 6);
        loop {
            // SAFETY: pause accesses no memory. Only the signal ends this helper.
            unsafe { libc::pause() };
        }
    }

    extern "C" fn leaf_stopped(_: i32) {
        // SAFETY: write and _exit are async-signal-safe. fd 3 is the owned
        // readiness pipe. Exiting stops every helper thread without Rust locks.
        unsafe {
            libc::write(3, b"leaf-stopped\n".as_ptr().cast(), 13);
            libc::_exit(0);
        }
    }
}

#[cfg(windows)]
mod windows {
    //! Real Windows job ownership.
    use std::io::{BufRead, BufReader, Read};
    use std::process::{Command, Stdio};

    use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

    #[test]
    fn job_close_kills_the_child_and_closes_its_pipes() {
        let groups: &dyn ProcessGroups = &SystemProcessGroups;
        let (mut child, mut reader) = {
            let mut command = Command::new("cmd.exe");
            command
                .args(["/d", "/s", "/c", "echo ready&set /p hold="])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped());
            groups.configure(&mut command).unwrap();
            let mut child = command.spawn().unwrap();
            let _group = groups.attach(&child).unwrap();
            let mut reader = BufReader::new(child.stdout.take().unwrap());
            let mut ready = String::new();
            reader.read_line(&mut ready).unwrap();
            assert_eq!(ready.trim(), "ready");
            assert!(child.try_wait().unwrap().is_none());
            (child, reader)
        };
        child.wait().unwrap();
        let mut remaining = String::new();
        reader.read_to_string(&mut remaining).unwrap();
        assert!(remaining.is_empty());
    }
}
