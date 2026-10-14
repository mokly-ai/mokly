//! Process group integration tests synchronized by a readiness line.

#[cfg(unix)]
mod unix {
    //! Real Unix process trees.

    use std::io::{BufRead, BufReader, Read};
    use std::process::{Command, Stdio};

    use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

    #[test]
    fn owned_process_group_terminates_descendants_and_closes_pipes() {
        let groups: &dyn ProcessGroups = &SystemProcessGroups;
        let mut command = Command::new("sh");
        command
            .args(["-c", r#"sh -c 'trap "printf \"descendant-stopped\n\"; exit 0" TERM; sleep 60 & printf "ready\n"; wait' & wait"#])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        groups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let group = groups.attach(&child).unwrap();
        let mut reader = BufReader::new(child.stdout.take().unwrap());
        let mut ready = String::new();
        reader.read_line(&mut ready).unwrap();
        assert_eq!(ready, "ready\n");
        group.terminate().unwrap();
        assert!(!child.wait().unwrap().success());
        let mut remaining = String::new();
        reader.read_to_string(&mut remaining).unwrap();
        assert_eq!(remaining.trim(), "descendant-stopped");
        group.kill().unwrap();
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
            (child, reader)
        };
        assert!(!child.wait().unwrap().success());
        let mut remaining = String::new();
        reader.read_to_string(&mut remaining).unwrap();
        assert!(remaining.is_empty());
    }
}
