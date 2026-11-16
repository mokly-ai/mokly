//! Plain groups retain the parent session and stop members after root reaping.

#![cfg(unix)]

use std::io::{BufRead, BufReader, Read, Write};
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
        let mut child = command.spawn().unwrap();
        let group = match SystemProcessGroups.attach(&child) {
            Ok(group) => group,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                panic!("attachment failed: {error}");
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
    let output = Command::new("ps")
        .args(["-o", "pgid=", "-o", "sess=", "-p", &pid.to_string()])
        .output()
        .unwrap();
    assert!(output.status.success());
    let text = String::from_utf8(output.stdout).unwrap();
    let fields: Vec<_> = text.split_whitespace().collect();
    assert_eq!(fields.len(), 2, "unexpected process identity: {text}");
    (fields[0].to_owned(), fields[1].to_owned())
}
