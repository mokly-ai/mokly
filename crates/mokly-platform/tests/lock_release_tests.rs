//! A dropped lock guard releases its lock while a started child still holds a copy of the file.

#![cfg(unix)]

use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::process::CommandExt;
use std::process::Command;
use std::thread;

use mokly_platform::locks::{Locks, SystemLocks};
use mokly_platform::processes::{ProcessGroups, SystemProcessGroups};

#[test]
fn a_dropped_guard_releases_its_lock_while_a_child_is_between_fork_and_exec() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("stripe.lock");
    let locks: &dyn Locks = &SystemLocks;
    let shared = locks.try_lock_shared(&path).unwrap();
    let (mut forked, forked_signal) = std::io::pipe().unwrap();
    let (release_wait, mut release) = std::io::pipe().unwrap();
    let signal = forked_signal.as_raw_fd();
    let wait = release_wait.as_raw_fd();
    let mut command = Command::new("true");
    SystemProcessGroups.configure(&mut command).unwrap();
    // SAFETY: write and read are async-signal-safe. The forked child owns copies
    // of both pipe descriptors until its exec, and the byte buffers live on its stack.
    unsafe {
        command.pre_exec(move || {
            libc::write(signal, b"f".as_ptr().cast(), 1);
            let mut byte = 0u8;
            libc::read(wait, (&raw mut byte).cast(), 1);
            Ok(())
        });
    }
    let child = thread::spawn(move || command.spawn().unwrap().wait().unwrap());
    let mut byte = [0u8];
    forked.read_exact(&mut byte).unwrap();
    {
        let _released = shared;
    }
    let exclusive = locks.try_lock(&path).map(|_| ());
    release.write_all(b"r").unwrap();
    assert!(child.join().unwrap().success());
    assert!(matches!(exclusive, Ok(())), "{exclusive:?}");
}
