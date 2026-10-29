//! A blocked Windows callback forces loss recovery through the real notify backend.
#![cfg(windows)]

use std::collections::BTreeSet;
use std::fs;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_watch::backend::{NativeEvents, NotifyFactory, WatchFactory};

struct BlockingEvents {
    first_seen: Sender<()>,
    release_first: Mutex<Receiver<()>>,
    rescan: Sender<notify::Result<notify::Event>>,
    first: Mutex<bool>,
}

impl NativeEvents for BlockingEvents {
    fn send(&self, event: notify::Result<notify::Event>) {
        let first = {
            let mut seen = self.first.lock().unwrap();
            let first = !*seen;
            *seen = true;
            first
        };
        if first {
            let _ = self.first_seen.send(());
            let _ = self.release_first.lock().unwrap().recv();
        }
        if event.is_err() || matches!(&event, Ok(event) if event.need_rescan()) {
            let _ = self.rescan.send(event);
        }
    }
}

struct ReleaseOnDrop(Sender<()>);

impl Drop for ReleaseOnDrop {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

#[cfg(windows)]
#[test]
fn windows_overflow_emits_a_rescan_after_the_handler_is_released() {
    let root = tempfile::tempdir().unwrap();
    let (first_seen_tx, first_seen_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let (rescan_tx, rescan_rx) = mpsc::channel();
    let events = Arc::new(BlockingEvents {
        first_seen: first_seen_tx,
        release_first: Mutex::new(release_rx),
        rescan: rescan_tx,
        first: Mutex::new(false),
    });
    let factory = NotifyFactory {
        tree: Arc::new(WorkingTree),
    };
    let mut watcher = factory.create(events).unwrap();
    let release = ReleaseOnDrop(release_tx);
    watcher
        .update(
            &BTreeSet::from([root.path().to_path_buf()]),
            &BTreeSet::new(),
        )
        .unwrap();

    fs::write(root.path().join("first-event"), b"first").unwrap();
    first_seen_rx.recv_timeout(Duration::from_secs(15)).unwrap();
    for index in 0..2_000 {
        let name = format!("{index:04}-{}", "x".repeat(100));
        fs::write(root.path().join(name), b"event").unwrap();
    }
    release.0.send(()).unwrap();

    let event = rescan_rx
        .recv_timeout(Duration::from_secs(15))
        .expect("the overflow must emit a rescan event")
        .unwrap();
    assert!(event.need_rescan());
}
