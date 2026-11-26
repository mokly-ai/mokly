//! The Git runner keeps its root process unreaped until its last tree signal.

#![cfg(unix)]

use std::mem::MaybeUninit;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

use mokly_git::command::{ProcessMode, Request, Runner};
use mokly_git::control::{SystemClock, Token};
use mokly_git::system::SystemRunner;
use mokly_platform::error::Result;
use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

/// The state of the root process when the guard sent one signal.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Root {
    Unreaped,
    Reaped,
}

/// A reaped child is gone from the wait queue. WNOWAIT leaves an unreaped
/// child as it is, so this check cannot reap the root itself.
fn root(pid: u32) -> Root {
    let mut info = MaybeUninit::<libc::siginfo_t>::zeroed();
    // SAFETY: The buffer has the exact siginfo_t size and stays alive for the
    // call. WNOHANG and WNOWAIT neither block nor reap.
    let result = unsafe {
        libc::waitid(
            libc::P_PID,
            pid,
            info.as_mut_ptr(),
            libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
        )
    };
    let error = std::io::Error::last_os_error();
    if result == -1 && error.raw_os_error() == Some(libc::ECHILD) {
        return Root::Reaped;
    }
    assert_eq!(result, 0, "waitid failed: {error}");
    Root::Unreaped
}

/// Real process groups whose guards record the root state at each signal.
struct Watched {
    states: Arc<Mutex<Vec<Root>>>,
}

impl ProcessGroups for Watched {
    fn configure(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure(command)
    }

    fn configure_plain(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure_plain(command)
    }

    fn attach(&self, child: &Child) -> Result<Box<dyn ProcessGroup>> {
        Ok(Box::new(WatchedGroup {
            pid: child.id(),
            inner: SystemProcessGroups.attach(child)?,
            states: Arc::clone(&self.states),
        }))
    }

    fn kill_unattached(&self, child: &Child) -> Result<()> {
        SystemProcessGroups.kill_unattached(child)
    }
}

struct WatchedGroup {
    pid: u32,
    inner: Box<dyn ProcessGroup>,
    states: Arc<Mutex<Vec<Root>>>,
}

impl ProcessGroup for WatchedGroup {
    fn terminate(&self) -> Result<()> {
        self.states.lock().unwrap().push(root(self.pid));
        self.inner.terminate()
    }

    fn kill(&self) -> Result<()> {
        self.states.lock().unwrap().push(root(self.pid));
        self.inner.kill()
    }
}

#[test]
fn a_finished_git_command_is_reaped_only_after_its_last_tree_signal() {
    for process_mode in [ProcessMode::FullTree, ProcessMode::PlainGroup] {
        let states = Arc::new(Mutex::new(Vec::new()));
        let runner: &dyn Runner = &SystemRunner {
            clock: Arc::new(SystemClock::default()),
            cancellation: Arc::new(Token::default()),
            groups: Arc::new(Watched {
                states: Arc::clone(&states),
            }),
        };
        let output = runner
            .run(&Request {
                process_mode,
                directory: std::env::current_dir().unwrap(),
                args: vec!["--version".into()],
                stdin: vec![],
                output_limit: 1024,
                stderr_limit: 1024,
            })
            .unwrap();
        assert!(output.stdout.starts_with(b"git version "));
        let states = states.lock().unwrap().clone();
        assert!(!states.is_empty(), "{process_mode:?}: no tree signal");
        assert!(
            !states.contains(&Root::Reaped),
            "{process_mode:?}: a tree signal followed the reap: {states:?}"
        );
    }
}
