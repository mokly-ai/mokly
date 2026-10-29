//! Real observation follows atomic saves and directory additions without symlinks.

use std::collections::BTreeSet;
use std::fs;
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_watch::backend::{NativeEvents, NotifyFactory, WatchFactory};
use mokly_watch::event::{Action, Event};
use mokly_watch::native::NativeObserver;
use mokly_watch::observer::Observer;
use mokly_watch::plan::Plan;

struct IgnoreEvents;

impl NativeEvents for IgnoreEvents {
    fn send(&self, _event: notify::Result<notify::Event>) {}
}

#[test]
fn path_update_skips_a_vanished_directory_and_attaches_later_directories() {
    let root = tempfile::tempdir().unwrap();
    let first = root.path().join("01-first");
    let vanished = root.path().join("02-vanished");
    let last = root.path().join("03-last");
    fs::create_dir(&first).unwrap();
    fs::create_dir(&vanished).unwrap();
    fs::create_dir(&last).unwrap();
    fs::remove_dir(&vanished).unwrap();

    let factory = NotifyFactory {
        tree: Arc::new(WorkingTree),
    };
    let mut watcher = factory.create(Arc::new(IgnoreEvents)).unwrap();
    let attached = watcher
        .update(
            &BTreeSet::from([first.clone(), vanished, last.clone()]),
            &BTreeSet::new(),
        )
        .unwrap();

    assert_eq!(attached, BTreeSet::from([first, last]));
}

async fn wait(observer: &dyn Observer, suffix: &str) -> Event {
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            observer.changed().await;
            for event in observer.take() {
                let event = event.unwrap();
                if event.path.ends_with(suffix) {
                    return event;
                }
            }
        }
    })
    .await
    .unwrap()
}

#[tokio::test]
async fn atomic_replacements_new_directories_and_shutdown_keep_one_observer() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    let source = root.path().join("specs/home.screen.html");
    fs::write(&source, "original").unwrap();
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader.load(root.path(), None).unwrap();
    let plan = Plan::new(
        &config,
        &["specs/home.screen.html".into()],
        &[],
        &BTreeSet::new(),
    )
    .unwrap();
    let observer: &dyn Observer = &NativeObserver::new(Arc::new(WorkingTree), &plan).unwrap();
    let replacement = root.path().join("specs/replacement.tmp");
    fs::write(&replacement, "changed").unwrap();
    fs::rename(replacement, &source).unwrap();
    assert_eq!(
        plan.classify(&wait(observer, "home.screen.html").await),
        Some(Action::Rebuild)
    );
    fs::create_dir(root.path().join("specs/added")).unwrap();
    wait(observer, "specs/added").await;
    observer.rescan(&plan).unwrap();
    fs::write(root.path().join("specs/added/new.screen.html"), "new").unwrap();
    assert_eq!(
        plan.classify(&wait(observer, "new.screen.html").await),
        Some(Action::Rebuild)
    );
    observer.close();
    observer.replace(&plan).unwrap();
    assert!(observer.take().is_empty());
}

#[cfg(windows)]
struct BlockingEvents {
    first_seen: std::sync::mpsc::Sender<()>,
    release_first: std::sync::Mutex<std::sync::mpsc::Receiver<()>>,
    rescan: std::sync::mpsc::Sender<()>,
    first: std::sync::Mutex<bool>,
}

#[cfg(windows)]
impl NativeEvents for BlockingEvents {
    fn send(&self, event: notify::Result<notify::Event>) {
        let first = {
            let mut seen = self.first.lock().unwrap();
            let first = !*seen;
            *seen = true;
            first
        };
        if first {
            self.first_seen.send(()).unwrap();
            self.release_first.lock().unwrap().recv().unwrap();
        }
        if matches!(&event, Ok(event) if event.need_rescan()) {
            self.rescan.send(()).unwrap();
        }
    }
}

#[cfg(windows)]
#[test]
fn windows_overflow_emits_a_rescan_after_the_handler_is_released() {
    let root = tempfile::tempdir().unwrap();
    let (first_seen_tx, first_seen_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let (rescan_tx, rescan_rx) = std::sync::mpsc::channel();
    let events = Arc::new(BlockingEvents {
        first_seen: first_seen_tx,
        release_first: std::sync::Mutex::new(release_rx),
        rescan: rescan_tx,
        first: std::sync::Mutex::new(false),
    });
    let factory = NotifyFactory {
        tree: Arc::new(WorkingTree),
    };
    let mut watcher = factory.create(events).unwrap();
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
    release_tx.send(()).unwrap();

    rescan_rx
        .recv_timeout(Duration::from_secs(15))
        .expect("the overflow must emit a rescan event");
}

#[tokio::test]
#[cfg(not(windows))]
async fn required_inputs_stay_observable_when_an_ancestor_is_replaced() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir_all(root.path().join("assets/nested/icons")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    let source = root.path().join("assets/nested/icons/logo.svg");
    fs::write(&source, "original").unwrap();
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader.load(root.path(), None).unwrap();
    let plan = Plan::new(
        &config,
        &[],
        &[],
        &BTreeSet::from(["assets/nested/icons/logo.svg".into()]),
    )
    .unwrap();
    let observer: &dyn Observer = &NativeObserver::new(Arc::new(WorkingTree), &plan).unwrap();
    fs::rename(
        root.path().join("assets/nested"),
        root.path().join("assets/moved"),
    )
    .unwrap();
    let removed = wait(observer, "assets/nested").await;
    assert_eq!(plan.classify(&removed), Some(Action::Reload));
    observer.rescan(&plan).unwrap();
    fs::create_dir_all(source.parent().unwrap()).unwrap();
    wait(observer, "assets/nested").await;
    observer.rescan(&plan).unwrap();
    fs::write(&source, "repaired").unwrap();
    assert_eq!(
        plan.classify(&wait(observer, "logo.svg").await),
        Some(Action::Reload)
    );
    observer.close();
}

#[cfg(windows)]
#[tokio::test]
async fn required_inputs_stay_observable_when_the_file_is_replaced() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::create_dir(root.path().join("assets")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    let source = root.path().join("assets/logo.svg");
    fs::write(&source, "original").unwrap();
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader.load(root.path(), None).unwrap();
    let plan = Plan::new(
        &config,
        &[],
        &[],
        &BTreeSet::from(["assets/logo.svg".into()]),
    )
    .unwrap();
    let observer: &dyn Observer = &NativeObserver::new(Arc::new(WorkingTree), &plan).unwrap();
    fs::write(&source, "repaired").unwrap();
    assert_eq!(
        plan.classify(&wait(observer, "logo.svg").await),
        Some(Action::Reload)
    );
    observer.close();
}
