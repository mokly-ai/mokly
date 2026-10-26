//! A started child, its captured output, and the values that other threads wait for.

use std::io::Read;
use std::path::PathBuf;
use std::process::{Child, ChildStderr, ChildStdout, Command};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use super::command::PUBLISH_BUILD;
use super::signals::signal;

/// The hang guard for one child process or one expected state.
const HANG_GUARD: Duration = Duration::from_secs(300);

/// The private build directory that a child reports, shared with other threads.
#[derive(Clone, Default)]
pub struct BuildDirectory(Arc<(Mutex<Option<PathBuf>>, Condvar)>);

impl BuildDirectory {
    /// Wait until the child reports its build directory.
    pub fn wait(&self) -> PathBuf {
        let (value, changed) = &*self.0;
        let (value, timeout) = changed
            .wait_timeout_while(value.lock().unwrap(), HANG_GUARD, |value| value.is_none())
            .unwrap();
        assert!(
            !timeout.timed_out(),
            "the child reported no build directory"
        );
        value.clone().unwrap()
    }

    fn set(&self, directory: PathBuf) {
        let (value, changed) = &*self.0;
        value.lock().unwrap().get_or_insert(directory);
        changed.notify_all();
    }
}

/// The process id of a child that starts after the code that needs it.
#[derive(Clone, Default)]
pub struct ChildId(Arc<(Mutex<Option<u32>>, Condvar)>);

impl ChildId {
    /// Record the process id of the started child.
    pub fn set(&self, pid: u32) {
        let (value, changed) = &*self.0;
        *value.lock().unwrap() = Some(pid);
        changed.notify_all();
    }

    /// Wait until the child has started, and return its process id.
    pub fn wait(&self) -> u32 {
        let (value, changed) = &*self.0;
        let (value, timeout) = changed
            .wait_timeout_while(value.lock().unwrap(), HANG_GUARD, |value| value.is_none())
            .unwrap();
        assert!(!timeout.timed_out(), "the child never started");
        value.unwrap()
    }
}

/// A started child whose threads capture standard output and standard error.
pub struct Running {
    child: Child,
    stdout: Arc<Mutex<Vec<u8>>>,
    stderr: Arc<Mutex<Vec<u8>>>,
    readers: Vec<JoinHandle<()>>,
    directory: BuildDirectory,
}

impl Running {
    /// Start `command` and the threads that capture both of its output streams.
    pub(super) fn start(mut command: Command) -> Self {
        let mut child = command.spawn().expect("mokly starts");
        let stdout = Arc::new(Mutex::new(Vec::new()));
        let stderr = Arc::new(Mutex::new(Vec::new()));
        let directory = BuildDirectory::default();
        let readers = vec![
            read_stdout(
                child.stdout.take().unwrap(),
                Arc::clone(&stdout),
                directory.clone(),
            ),
            read_stderr(child.stderr.take().unwrap(), Arc::clone(&stderr)),
        ];
        Self {
            child,
            stdout,
            stderr,
            readers,
            directory,
        }
    }

    /// The process id of the child.
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    /// Send the signal `name`, such as `INT`, to the child.
    pub fn signal(&self, name: &str) {
        signal(self.pid(), name);
    }

    /// The build directory that the child reports or will report.
    pub fn build_directory(&self) -> BuildDirectory {
        self.directory.clone()
    }

    /// Whether the child has exited.
    pub fn has_exited(&mut self) -> bool {
        self.child.try_wait().unwrap().is_some()
    }

    /// Standard output so far.
    pub fn stdout(&self) -> String {
        String::from_utf8_lossy(&self.stdout.lock().unwrap()).into_owned()
    }

    /// Wait for the child to exit and for both output streams to close.
    pub fn wait(mut self) -> Finished {
        let started = Instant::now();
        let status = loop {
            if let Some(status) = self.child.try_wait().unwrap() {
                break status;
            }
            if started.elapsed() > HANG_GUARD {
                let _ = self.child.kill();
                panic!("mokly did not exit; stderr: {}", self.stderr());
            }
            thread::sleep(Duration::from_millis(10));
        };
        for reader in self.readers.drain(..) {
            reader.join().unwrap();
        }
        Finished {
            code: status.code(),
            stdout: self.stdout(),
            stderr: self.stderr(),
        }
    }

    /// Standard error so far.
    pub fn stderr(&self) -> String {
        String::from_utf8_lossy(&self.stderr.lock().unwrap()).into_owned()
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        for reader in self.readers.drain(..) {
            let _ = reader.join();
        }
    }
}

/// The exit code and the complete output of a finished child.
#[derive(Debug)]
pub struct Finished {
    /// The exit code, or `None` when a signal ended the child.
    pub code: Option<i32>,
    /// Standard output.
    pub stdout: String,
    /// Standard error.
    pub stderr: String,
}

fn read_stdout(
    mut stream: ChildStdout,
    output: Arc<Mutex<Vec<u8>>>,
    directory: BuildDirectory,
) -> JoinHandle<()> {
    thread::spawn(move || {
        let mut chunk = [0; 8192];
        while let Ok(read) = stream.read(&mut chunk) {
            if read == 0 {
                break;
            }
            let mut output = output.lock().unwrap();
            output.extend_from_slice(&chunk[..read]);
            if let Some(found) = reported_directory(&output) {
                directory.set(found);
            }
        }
    })
}

fn read_stderr(mut stream: ChildStderr, output: Arc<Mutex<Vec<u8>>>) -> JoinHandle<()> {
    thread::spawn(move || {
        let mut chunk = [0; 8192];
        while let Ok(read) = stream.read(&mut chunk) {
            if read == 0 {
                break;
            }
            output.lock().unwrap().extend_from_slice(&chunk[..read]);
        }
    })
}

fn reported_directory(output: &[u8]) -> Option<PathBuf> {
    let text = String::from_utf8_lossy(output);
    let complete = &text[..text.rfind('\n')?];
    complete
        .split('\n')
        .find_map(|line| line.strip_prefix(PUBLISH_BUILD))
        .map(|path| PathBuf::from(path.trim_end_matches('\r')))
}
