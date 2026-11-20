//! Explicit supervisor waits and process ownership for completion integration tests.

#[cfg(target_os = "linux")]
use std::path::Path;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{Receiver, SyncSender, sync_channel};
use std::sync::{Arc, Mutex};
use std::thread::{self, Thread};
use std::time::Duration;
#[cfg(target_os = "linux")]
use std::time::Instant;

use mokly_git::control::{Clock, SystemClock, Token};
use mokly_git::system::SystemRunner;
use mokly_platform::error::Result;
use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

const HANG_GUARD: Duration = Duration::from_secs(10);

/// Controls the runner's wait and process group for completion-order checks.
pub(super) struct Supervisor {
    clock: Arc<ParkClock>,
    groups: Arc<TrackedGroups>,
    parked: Receiver<()>,
}

impl Supervisor {
    /// Create the controlled wait and its readiness notification.
    pub(super) fn new() -> Self {
        let (ready, parked) = sync_channel(1);
        Self {
            clock: Arc::new(ParkClock {
                system: SystemClock::default(),
                armed: AtomicBool::new(false),
                released: AtomicBool::new(false),
                thread: Mutex::new(None),
                ready,
            }),
            groups: Arc::new(TrackedGroups::default()),
            parked,
        }
    }

    /// Build a runner that uses the controlled wait and tracked process group.
    pub(super) fn runner(&self) -> SystemRunner {
        SystemRunner {
            clock: self.clock.clone(),
            cancellation: Arc::new(Token::default()),
            groups: self.groups.clone(),
        }
    }

    /// Arm the wait and observe when supervision enters it.
    pub(super) fn park(&self) {
        self.clock.armed.store(true, Ordering::Release);
        self.parked
            .recv_timeout(HANG_GUARD)
            .expect("supervisor did not enter the injected wait");
    }

    /// Receive the result before the test releases its timer.
    pub(super) fn finish<T>(&self, result: &Receiver<T>) -> T {
        let received = result.recv_timeout(HANG_GUARD);
        if received.is_err() {
            self.clock.release();
            self.groups.kill();
        }
        assert!(
            received.is_ok(),
            "Git did not settle by completion notification before the test released its timer"
        );
        received.ok().unwrap()
    }

    #[cfg(target_os = "linux")]
    /// Wait until the runner has reaped its Linux child.
    pub(super) fn wait_for_child_exit(&self) {
        let pid = self.groups.pid.load(Ordering::Acquire);
        assert_ne!(pid, 0);
        let path = format!("/proc/{pid}");
        let deadline = Instant::now() + HANG_GUARD;
        while Path::new(&path).exists() {
            assert!(Instant::now() < deadline, "Git child did not exit");
            thread::yield_now();
        }
    }
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.clock.release();
        self.groups.kill();
    }
}

struct ParkClock {
    system: SystemClock,
    armed: AtomicBool,
    released: AtomicBool,
    thread: Mutex<Option<Thread>>,
    ready: SyncSender<()>,
}

impl ParkClock {
    fn release(&self) {
        self.released.store(true, Ordering::Release);
        if let Some(thread) = self.thread.lock().unwrap().as_ref() {
            thread.unpark();
        }
    }
}

impl Clock for ParkClock {
    fn now(&self) -> Duration {
        self.system.now()
    }

    fn pause(&self, duration: Duration) {
        if !self.armed.load(Ordering::Acquire) {
            self.system.pause(duration);
            return;
        }
        *self.thread.lock().unwrap() = Some(thread::current());
        let _ = self.ready.try_send(());
        if !self.released.load(Ordering::Acquire) {
            thread::park();
        }
    }
}

#[derive(Default)]
struct TrackedGroups {
    pid: AtomicU32,
    group: Mutex<Option<Arc<dyn ProcessGroup>>>,
}

impl TrackedGroups {
    fn kill(&self) {
        if let Some(group) = self.group.lock().unwrap().as_ref() {
            let _ = group.kill();
        }
    }
}

impl ProcessGroups for TrackedGroups {
    fn configure(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure(command)
    }

    fn configure_plain(&self, command: &mut Command) -> Result<()> {
        SystemProcessGroups.configure_plain(command)
    }

    fn attach(&self, child: &Child) -> Result<Box<dyn ProcessGroup>> {
        let group: Arc<dyn ProcessGroup> = Arc::from(SystemProcessGroups.attach(child)?);
        *self.group.lock().unwrap() = Some(group.clone());
        self.pid.store(child.id(), Ordering::Release);
        Ok(Box::new(SharedGroup(group)))
    }
}

struct SharedGroup(Arc<dyn ProcessGroup>);

impl ProcessGroup for SharedGroup {
    fn terminate(&self) -> Result<()> {
        self.0.terminate()
    }

    fn kill(&self) -> Result<()> {
        self.0.kill()
    }
}
