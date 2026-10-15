//! An unfinished dependency install cannot hold unrelated namespace operations.

use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use mokly_compare::cache_types::{Builder, Cache, Kind};
use mokly_compare::error::Result;

use support::{Files, cache};

#[expect(
    dead_code,
    reason = "Host fixture helpers are shared across integration targets."
)]
mod support;

struct PendingBuilder {
    started: mpsc::Sender<()>,
    resume: Mutex<mpsc::Receiver<()>>,
}

impl Builder for PendingBuilder {
    fn build(&self, destination: &Path) -> Result<()> {
        self.started.send(()).unwrap();
        self.resume
            .lock()
            .unwrap()
            .recv_timeout(Duration::from_secs(10))
            .unwrap();
        fs::create_dir(destination).unwrap();
        fs::write(destination.join("file"), b"done").unwrap();
        Ok(())
    }
}

#[test]
fn a_distinct_key_completes_while_another_build_remains_pending() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = Arc::new(cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    ));
    let (started, ready) = mpsc::channel();
    let (resume, pending) = mpsc::channel();
    let owner = Arc::clone(&cache);
    let first = thread::spawn(move || {
        owner
            .get(
                Kind::Dependencies,
                &"a".repeat(64),
                &PendingBuilder {
                    started,
                    resume: Mutex::new(pending),
                },
            )
            .unwrap()
    });
    ready.recv_timeout(Duration::from_secs(10)).unwrap();
    let second = cache
        .get(Kind::Dependencies, &"b".repeat(64), &Files::new())
        .unwrap();
    assert_eq!(fs::read(second.directory.join("file")).unwrap(), b"content");
    assert!(!first.is_finished());
    resume.send(()).unwrap();
    assert_eq!(
        fs::read(first.join().unwrap().directory.join("file")).unwrap(),
        b"done"
    );
}
