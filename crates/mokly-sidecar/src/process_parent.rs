//! Parent-death protection runs before exec and closes the fork-to-registration race.

use std::io;
use std::process::{Child, Command};
#[cfg(target_os = "linux")]
use std::sync::{Mutex, mpsc};

#[cfg(target_os = "linux")]
use std::os::unix::process::CommandExt;

/// Process launch boundary keeps Linux parent-death ownership on a durable thread.
pub(super) trait ParentSpawn: Send + Sync {
    /// Spawn with ownership that remains valid until the pool closes.
    fn spawn(&self, command: Command) -> io::Result<Child>;
}

#[cfg(target_os = "linux")]
type Launch = (Command, mpsc::SyncSender<io::Result<Child>>);

/// Lazy process launcher whose thread shares the pool lifetime.
#[derive(Default)]
pub(super) struct ParentSpawner {
    #[cfg(target_os = "linux")]
    sender: Mutex<Option<mpsc::SyncSender<Launch>>>,
}

impl ParentSpawn for ParentSpawner {
    fn spawn(&self, command: Command) -> io::Result<Child> {
        #[cfg(target_os = "linux")]
        {
            let sender = {
                let mut state = self
                    .sender
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                if state.is_none() {
                    let (sender, receiver) = mpsc::sync_channel::<Launch>(1);
                    std::thread::Builder::new()
                        .name("mokly-sidecar-parent".into())
                        .spawn(move || {
                            for (mut command, response) in receiver {
                                configure(&mut command);
                                let _ = response.send(command.spawn());
                            }
                        })?;
                    *state = Some(sender);
                }
                state.clone()
            };
            let (response, result) = mpsc::sync_channel(1);
            if sender.is_none_or(|sender| sender.send((command, response)).is_err()) {
                return Err(io::ErrorKind::BrokenPipe.into());
            }
            match result.recv() {
                Ok(result) => result,
                Err(_) => Err(io::ErrorKind::BrokenPipe.into()),
            }
        }
        #[cfg(not(target_os = "linux"))]
        {
            let mut command = command;
            command.spawn()
        }
    }
}

#[cfg(target_os = "linux")]
fn configure(command: &mut Command) {
    #[cfg(target_os = "linux")]
    {
        let parent = std::process::id();
        // SAFETY: the child callback uses only async-signal-safe kernel calls before exec.
        // Registering SIGKILL makes parent death independent of the child's JavaScript thread.
        // The parent PID check closes the race where the parent exits before prctl runs.
        unsafe {
            command.pre_exec(move || {
                if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                if libc::getppid() as u32 != parent {
                    libc::raise(libc::SIGKILL);
                }
                Ok(())
            });
        }
    }
}
