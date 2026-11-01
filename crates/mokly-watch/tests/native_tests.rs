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
use tokio::sync::mpsc;

struct CapturedEvents(mpsc::UnboundedSender<notify::Result<notify::Event>>);

impl NativeEvents for CapturedEvents {
    fn send(&self, event: notify::Result<notify::Event>) {
        let _ = self.0.send(event);
    }
}

#[tokio::test]
async fn path_update_skips_a_vanished_directory_and_attaches_later_directories() {
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
    let (events_tx, mut events_rx) = mpsc::unbounded_channel();
    let mut watcher = factory.create(Arc::new(CapturedEvents(events_tx))).unwrap();
    let attached = watcher
        .update(
            &BTreeSet::from([first.clone(), vanished, last.clone()]),
            &BTreeSet::new(),
        )
        .unwrap();

    assert_eq!(attached, BTreeSet::from([first, last.clone()]));
    let source = last.join("after-vanished");
    fs::write(&source, "observed").unwrap();
    let event = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let event = events_rx.recv().await.unwrap().unwrap();
            if event.paths.contains(&source) {
                return event;
            }
        }
    })
    .await
    .expect("the directory after the vanished path must deliver events");
    assert!(event.paths.contains(&source));
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
