//! Plain groups retain the parent session and stop members after root reaping.

#![cfg(unix)]

use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::{self, Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

struct OwnedChild {
    child: Child,
    group: Box<dyn ProcessGroup>,
}

impl Drop for OwnedChild {
    fn drop(&mut self) {
        let _ = self.group.kill();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[test]
fn plain_groups_keep_the_session_and_signal_members_after_reaping() {
    let parent_session = identity(process::id()).1;
    for plain in [false, true] {
        let mut command = Command::new("sh");
        command
            .args([
                "-c",
                "sh -c 'printf \"ready\\n\"; exec sleep 60' & read release; exit 23",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        if plain {
            SystemProcessGroups.configure_plain(&mut command).unwrap();
        } else {
            SystemProcessGroups.configure(&mut command).unwrap();
        }
        let child = command.spawn().unwrap();
        // The test reaps the root before the last group signal, so it takes
        // the child and the guard out of the tree.
        let (mut child, group) = match SystemProcessGroups.attach(child) {
            Ok(tree) => tree.into_parts(),
            Err(failure) => {
                let mut unattached = failure.stop(&SystemProcessGroups);
                let _ = unattached.child.kill();
                let _ = unattached.child.wait();
                panic!("attachment failed: {}", unattached.source);
            }
        };
        let stdout = child.stdout.take().unwrap();
        let mut owned = OwnedChild { child, group };
        let (sent, received) = mpsc::channel();
        let reader = thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut ready = Vec::new();
            reader.read_until(b'\n', &mut ready).unwrap();
            let _ = sent.send(ready);
            let mut remaining = Vec::new();
            reader.read_to_end(&mut remaining).unwrap();
            let _ = sent.send(remaining);
        });
        assert_eq!(
            received.recv_timeout(Duration::from_secs(10)).unwrap(),
            b"ready\n"
        );
        let (group_id, session) = identity(owned.child.id());
        assert_eq!(group_id, owned.child.id().to_string());
        assert_eq!(session == parent_session, plain, "plain={plain}");
        owned
            .child
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"exit\n")
            .unwrap();
        assert_eq!(owned.child.wait().unwrap().code(), Some(23));
        owned.group.terminate().unwrap();
        assert_eq!(
            received.recv_timeout(Duration::from_secs(10)).unwrap(),
            Vec::<u8>::new()
        );
        reader.join().unwrap();
    }
}

fn identity(pid: u32) -> (String, String) {
    let pid = libc::pid_t::try_from(pid).unwrap();
    // SAFETY: The positive PID names this test or its live, unreaped child.
    // getpgid reads kernel process metadata and accesses no caller memory.
    let group = unsafe { libc::getpgid(pid) };
    assert_ne!(
        group,
        -1,
        "getpgid({pid}) failed: {}",
        io::Error::last_os_error()
    );
    // SAFETY: The positive PID names this test or its live, unreaped child.
    // getsid reads kernel process metadata and accesses no caller memory.
    let session = unsafe { libc::getsid(pid) };
    assert_ne!(
        session,
        -1,
        "getsid({pid}) failed: {}",
        io::Error::last_os_error()
    );
    (group.to_string(), session.to_string())
}
