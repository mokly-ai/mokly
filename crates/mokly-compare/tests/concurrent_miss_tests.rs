//! Concurrent cold callers share a build and receive simultaneous read leases.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex, mpsc};
use std::thread;

use mokly_compare::cache_types::{Builder, Cache, Kind};
use mokly_compare::error::Result;
use mokly_platform::error::Error;
use mokly_platform::locks::{Locks, LocksMock, SystemLocks};
use unimock::{MockFn, Unimock, matching};

#[expect(
    dead_code,
    reason = "Shared host composition also serves install tests."
)]
mod support;

#[test]
fn two_callers_miss_before_a_blocked_builder_and_both_retain_leases() {
    let temporary = tempfile::tempdir().unwrap();
    let mut cache = support::cache(
        temporary.path().canonicalize().unwrap().join("cache"),
        10000,
    );
    let misses = Arc::new(Barrier::new(2));
    let attempts = Arc::new(AtomicUsize::new(0));
    let (contended_tx, contended_rx) = mpsc::channel();
    cache.locks = Arc::new(Unimock::new((
        LocksMock::try_lock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if path.parent().unwrap().ends_with("locks")
                    && attempts.fetch_add(1, Ordering::SeqCst) < 2
                {
                    misses.wait();
                }
                let result = SystemLocks.try_lock(path);
                if matches!(result, Err(Error::Locked { .. })) {
                    contended_tx.send(()).unwrap();
                }
                result
            })),
        LocksMock::try_lock_shared
            .each_call(matching!(_))
            .answers(&|_, path| SystemLocks.try_lock_shared(path)),
    )));
    let cache = Arc::new(cache);
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let builder: Arc<dyn Builder> = Arc::new(BlockedFiles {
        calls: AtomicUsize::new(0),
        started: started_tx,
        release: Mutex::new(release_rx),
    });
    let handles = (0..2)
        .map(|_| {
            let cache = cache.clone();
            let builder = builder.clone();
            thread::spawn(move || {
                cache
                    .get(Kind::Sources, &"a".repeat(40), builder.as_ref())
                    .unwrap()
            })
        })
        .collect::<Vec<_>>();
    started_rx.recv().unwrap();
    contended_rx.recv().unwrap();
    release_tx.send(()).unwrap();
    let leases = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(leases[0].directory, leases[1].directory);
    for lease in &leases {
        assert_eq!(fs::read(lease.directory.join("file")).unwrap(), b"content");
    }
}

struct BlockedFiles {
    calls: AtomicUsize,
    started: mpsc::Sender<()>,
    release: Mutex<mpsc::Receiver<()>>,
}

impl Builder for BlockedFiles {
    fn build(&self, destination: &Path) -> Result<()> {
        assert_eq!(self.calls.fetch_add(1, Ordering::SeqCst), 0);
        fs::create_dir(destination).unwrap();
        fs::write(destination.join("file"), b"content").unwrap();
        self.started.send(()).unwrap();
        self.release.lock().unwrap().recv().unwrap();
        Ok(())
    }
}
