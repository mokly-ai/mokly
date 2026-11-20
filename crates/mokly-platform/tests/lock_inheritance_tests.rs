//! Guard release stays effective while another sidecar is between fork and exec.

#![cfg(unix)]

use std::io::{self, Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::net::UnixStream;
use std::os::unix::process::CommandExt;
use std::process::Command;
use std::thread;

use mokly_platform::locks::{Locks, SystemLocks};
use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

#[test]
fn released_reader_does_not_block_a_writer_while_a_child_waits_before_exec() {
    let temporary = tempfile::tempdir().unwrap();
    let path = temporary.path().join("reader.lock");
    let (mut parent, child) = UnixStream::pair().unwrap();
    let (write, child_pending, status) = thread::scope(|scope| {
        let spawning;
        {
            let _reader = SystemLocks.try_lock_shared(&path).unwrap();
            spawning = scope.spawn(move || {
                let mut command = Command::new("sh");
                command.args(["-c", "exit 0"]);
                SystemProcessGroups.configure(&mut command).unwrap();
                let socket = child.as_raw_fd();
                // SAFETY: The socket stays open until spawn completes. The callback
                // uses only async-signal-safe reads and writes on one stack byte.
                unsafe {
                    command.pre_exec(move || {
                        let mut byte = 1u8;
                        if libc::write(socket, (&byte as *const u8).cast(), 1) != 1 {
                            return Err(io::Error::last_os_error());
                        }
                        if libc::read(socket, (&mut byte as *mut u8).cast(), 1) != 1 {
                            return Err(io::Error::last_os_error());
                        }
                        Ok(())
                    });
                }
                command.spawn()
            });
            let mut ready = [0];
            parent.read_exact(&mut ready).unwrap();
            assert_eq!(ready, [1]);
        }
        let write = SystemLocks.try_lock(&path);
        let child_pending = !spawning.is_finished();
        parent.write_all(&[0]).unwrap();
        let status = spawning.join().unwrap().unwrap().wait().unwrap();
        (write, child_pending, status)
    });
    assert!(status.success());
    assert!(
        child_pending,
        "the child remains at its explicit pre-exec barrier"
    );
    assert!(
        write.is_ok(),
        "the parent dropped its shared guard, but the inherited descriptor blocked the writer: {:?}",
        write.err()
    );
}
